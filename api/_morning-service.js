/**
 * =========================================================================
 * Morning (Green Invoice) Integration Service - הריזורט לכלב
 * Handles:
 * 1. Automatic OAuth2 token retrieval and caching
 * 2. Client search by email / name / phone
 * 3. Client creation (with business-specific remarks: Resort vs. Teacher Rights)
 * 4. Automatic association of unlinked documents to the client card
 * =========================================================================
 */

const MORNING_API_KEY = process.env.MORNING_API_KEY || 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = process.env.MORNING_SECRET || 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtain access token for Morning API (OAuth2 Client Credentials)
 */
export async function getMorningToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 300) {
    return cachedToken;
  }

  const res = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MORNING_API_KEY,
      client_secret: MORNING_SECRET
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Morning token request failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedToken = data.accessToken || data.token;
  tokenExpiresAt = data.expiresAt || (now + 3600);
  return cachedToken;
}

/**
 * Synchronize customer to Morning and associate recent document
 * @param {Object} params
 * @param {string} params.fullName - Full name of customer
 * @param {string} [params.phone] - Phone number
 * @param {string} [params.email] - Email address
 * @param {number} [params.amount] - Payment amount
 * @param {string} [params.transactionId] - Grow transaction ID
 * @param {'resort' | 'teacher_rights'} [params.businessType] - Resort or Teacher Rights
 * @param {string} [params.serviceName] - Specific service description
 * @param {string} [params.dogName] - Dog name for resort bookings
 */
export async function syncMorningCustomer({
  fullName,
  phone = '',
  email = '',
  amount = 0,
  transactionId = '',
  businessType = 'resort',
  serviceName = '',
  dogName = ''
}) {
  try {
    if (!fullName || !fullName.trim()) return null;
    const token = await getMorningToken();

    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = fullName.trim();

    // Custom remarks per business
    const remarks = businessType === 'teacher_rights'
      ? (serviceName ? `זכויות המורה - ${serviceName}` : 'זכויות המורה')
      : `הריזורט לכלב - כלב: ${dogName || 'כלב'}${serviceName ? ` (${serviceName})` : ''}`;

    console.log(`[Morning] Syncing customer: ${cleanName} (${remarks})...`);

    let client = null;

    // 1. Search by email if available
    if (cleanEmail) {
      try {
        const sRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: cleanEmail })
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.items && sData.items.length > 0) {
            client = sData.items[0];
            console.log(`[Morning] Found existing client by email: ${client.name} (${client.id})`);
          }
        }
      } catch (errSearchEmail) {
        console.warn('[Morning] Search by email warning:', errSearchEmail.message);
      }
    }

    // 2. Search by name if not found by email
    if (!client && cleanName) {
      try {
        const sRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: cleanName })
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.items && sData.items.length > 0) {
            const phoneMatch = cleanPhone ? sData.items.find(c => {
              const cp = (c.phone || c.mobile || '').replace(/\D/g, '');
              return cp && (cp.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(cp.slice(-7)));
            }) : null;
            client = phoneMatch || sData.items[0];
            console.log(`[Morning] Found existing client by name: ${client.name} (${client.id})`);
          }
        }
      } catch (errSearchName) {
        console.warn('[Morning] Search by name warning:', errSearchName.message);
      }
    }

    // 3. Create new client if not found
    if (!client) {
      console.log(`[Morning] Client "${cleanName}" not found in Morning. Creating new client...`);
      const createRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: cleanName,
          emails: cleanEmail ? [cleanEmail] : [],
          phone: cleanPhone || '',
          mobile: cleanPhone || '',
          country: 'IL',
          remarks: remarks
        })
      });

      if (!createRes.ok) {
        const cErr = await createRes.text();
        console.error(`[Morning] Failed to create client: ${cErr}`);
        return null;
      }

      client = await createRes.json();
      console.log(`[Morning] ✓ Successfully created new client in Morning: ${client.name} (ID: ${client.id})`);
    }

    // 4. Try to associate recent Grow document if present
    if (client && client.id && amount > 0) {
      try {
        const dRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ pageSize: 10 })
        });

        if (dRes.ok) {
          const dData = await dRes.json();
          const targetAmt = Number(amount);

          const matchingDoc = (dData.items || []).find(doc => {
            const docAmt = Number(doc.amount || doc.calculatedAmountLocal || 0);
            const amtMatch = Math.abs(docAmt - targetAmt) < 1;
            const docClientName = (doc.client?.name || doc.description || '').toLowerCase();
            const nameMatch = cleanName && docClientName.includes(cleanName.toLowerCase().slice(0, 4));
            // Only associate if doc is not already associated to this client
            return amtMatch && nameMatch && doc.client?.id !== client.id;
          });

          if (matchingDoc) {
            console.log(`[Morning] Found matching document #${matchingDoc.number} (${matchingDoc.id}). Associating with client ${client.id}...`);
            const aRes = await fetch(`https://api.greeninvoice.co.il/api/v1/clients/${client.id}/assoc`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: client.id,
                ids: [matchingDoc.id]
              })
            });

            if (aRes.ok) {
              console.log(`[Morning] ✓ Successfully linked document #${matchingDoc.number} to client ${client.name} in Morning!`);
            } else {
              const aErr = await aRes.text();
              console.log(`[Morning] Associate returned status ${aRes.status}: ${aErr}`);
            }
          }
        }
      } catch (eDoc) {
        console.warn('[Morning] Non-blocking document association warning:', eDoc.message);
      }
    }

    return client;
  } catch (err) {
    console.error('[Morning] Error in syncMorningCustomer:', err);
    return null;
  }
}
