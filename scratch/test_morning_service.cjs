const fetch = globalThis.fetch || require('node-fetch');

const MORNING_API_KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getMorningToken() {
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
    throw new Error(`Morning token failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  cachedToken = data.accessToken || data.token;
  tokenExpiresAt = data.expiresAt || (now + 3600);
  return cachedToken;
}

async function syncMorningCustomer({
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

    const remarks = businessType === 'teacher_rights'
      ? (serviceName ? `זכויות המורה - ${serviceName}` : 'זכויות המורה')
      : `הריזורט לכלב - כלב: ${dogName || 'כלב'}${serviceName ? ` (${serviceName})` : ''}`;

    console.log(`[Morning] Syncing customer: ${cleanName} (📞 ${cleanPhone || 'none'}, ✉️ ${cleanEmail || 'none'}) - ${remarks}`);

    let client = null;

    // 1. Search by email if available
    if (cleanEmail) {
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
    }

    // 2. Search by name if not found by email
    if (!client && cleanName) {
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
          // If multiple, try to find one matching phone
          const phoneMatch = cleanPhone ? sData.items.find(c => {
            const cp = (c.phone || c.mobile || '').replace(/\D/g, '');
            return cp && (cp.endsWith(cleanPhone.slice(-7)) || cleanPhone.endsWith(cp.slice(-7)));
          }) : null;
          client = phoneMatch || sData.items[0];
          console.log(`[Morning] Found existing client by name: ${client.name} (${client.id})`);
        }
      }
    }

    // 3. Create client if not found
    if (!client) {
      console.log(`[Morning] Client not found. Creating new client for ${cleanName}...`);
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
      console.log(`[Morning] ✓ Successfully created new client: ${client.name} (${client.id})`);
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
          // Look for doc matching amount and customer name within recent items
          const matchingDoc = (dData.items || []).find(doc => {
            const docAmt = Number(doc.amount || doc.calculatedAmountLocal || 0);
            const amtMatch = Math.abs(docAmt - targetAmt) < 1;
            const docClientName = (doc.client?.name || doc.description || '').toLowerCase();
            const nameMatch = cleanName && docClientName.includes(cleanName.toLowerCase().slice(0, 4));
            return amtMatch && nameMatch;
          });

          if (matchingDoc) {
            console.log(`[Morning] Found matching unlinked document: #${matchingDoc.number} (${matchingDoc.id}). Associating with client ${client.id}...`);
            const aRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients/associate-documents', {
              method: 'PUT',
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
              console.log(`[Morning] ✓ Successfully associated document #${matchingDoc.number} with client ${client.name}!`);
            } else {
              console.log(`[Morning] Associate returned status ${aRes.status}`);
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

// Test call
async function run() {
  console.log('Testing syncMorningCustomer for an existing client...');
  const res = await syncMorningCustomer({
    fullName: 'Elías Bruckman',
    email: 'elibruckman@gmail.com',
    phone: '0538807573',
    businessType: 'resort',
    dogName: 'מילקי'
  });
  console.log('Sync result client ID:', res?.id);
}

run();
