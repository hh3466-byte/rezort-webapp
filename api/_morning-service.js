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

export const MORNING_CATALOG_ITEMS = {
  RESORT_DEFAULT: {
    id: '5a0cd740-9c57-4f41-9ff7-059f9ca89f6a',
    name: 'הריזורט לכלב',
    price: 0
  },
  BOARDING: {
    id: 'be8dca87-e26e-45fb-b746-128d93e9317b',
    name: 'שירותי פנסיון',
    price: 0
  },
  TRAINING: {
    id: 'd9d15fab-bd75-4eb2-832f-72cf76c5b16d',
    name: 'אילוף כלבים',
    price: 0
  },
  DAYCARE: {
    id: 'c0086288-d22c-4f1a-a8fd-bd57accab375',
    name: 'שהות יומית',
    price: 0
  },
  PASS: {
    id: 'd2ca2291-8ec0-4131-9c8d-edbccfce55d5',
    name: 'כרטיסיית ימי שהייה',
    price: 0
  },
  EXTRA: {
    id: '26823baf-73ac-4986-92e7-1a356d66c383',
    name: 'שירותי אקסטרה',
    price: 0
  }
};

/**
 * Format date to DD.MM.YY (2-digit year) as strictly mandated by Hagai
 * Examples: '2026-10-24' -> '24.10.26', '24.10.2026' -> '24.10.26'
 */
export function formatDateYY(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 4 ? parts[2].slice(2) : parts[2];
      return `${day}.${month}.${year}`;
    }
  }

  const dateOnly = str.split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0].length === 4 ? parts[0].slice(2) : parts[0];
    return `${day}.${month}.${year}`;
  }

  return str;
}

/**
 * Builds the exact 2nd row description string as mandated by Hagai:
 * - פנסיון: עבור שירותי פנסיון ל "שם הכלב" לתאריכים DD.MM.YY עד DD.MM.YY
 * - אילוף: בעבור אילוף ל "שם הכלב"
 * - יומיות: בעבור יומיות ל "שם הכלב" לתאריך DD.MM.YY (או לתאריכים...)
 * - כרטיסיה: בעבור כרטיסיה ל XX ימי שהיה / בעבור כרטיסיה ל XXX יממות שהיה
 * - אקסטרה: בעבור + [הטקסט שכתוב באקסטרה]
 */
export function buildMorningServiceDescription({
  serviceType = 'boarding',
  dogName = '',
  startDate = '',
  endDate = '',
  extraDescription = '',
  passType = 'days',
  passCount = 10
} = {}) {
  const cleanDog = (dogName || '').trim();
  const sType = String(serviceType || '').toLowerCase();
  const extra = (extraDescription || '').trim();

  // 1. Extra charge (אקסטרה)
  if (extra) {
    let cleanExtra = extra;
    if (cleanExtra.startsWith('בעבור ')) {
      cleanExtra = cleanExtra.slice(6).trim();
    } else if (cleanExtra.startsWith('עבור ')) {
      cleanExtra = cleanExtra.slice(5).trim();
    }
    return {
      serviceDescription: `בעבור ${cleanExtra}`,
      catalogItem: MORNING_CATALOG_ITEMS.EXTRA
    };
  }

  // 2. Training (אילוף)
  if (sType.includes('training') || sType.includes('אילוף')) {
    return {
      serviceDescription: cleanDog ? `בעבור אילוף ל "${cleanDog}"` : `בעבור אילוף`,
      catalogItem: MORNING_CATALOG_ITEMS.TRAINING
    };
  }

  // 3. Daycare (יומיות)
  if (sType.includes('daycare') || sType.includes('יומית') || sType.includes('יומיות')) {
    const startStr = formatDateYY(startDate);
    const endStr = formatDateYY(endDate);
    const datesStr = (endStr && endStr !== startStr) 
      ? `לתאריכים ${startStr} עד ${endStr}` 
      : (startStr ? `לתאריך ${startStr}` : '');

    return {
      serviceDescription: cleanDog
        ? `בעבור יומיות ל "${cleanDog}"${datesStr ? ` ${datesStr}` : ''}`
        : `בעבור יומיות${datesStr ? ` ${datesStr}` : ''}`,
      catalogItem: MORNING_CATALOG_ITEMS.DAYCARE
    };
  }

  // 4. Pass / Bank of days (כרטיסיה)
  if (sType.includes('pass') || sType.includes('כרטיסיה') || sType.includes('כרטיסייה')) {
    const count = passCount || 10;
    const unitWord = passType === 'nights' ? 'יממות שהיה' : 'ימי שהיה';
    return {
      serviceDescription: `בעבור כרטיסיה ל ${count} ${unitWord}`,
      catalogItem: MORNING_CATALOG_ITEMS.PASS
    };
  }

  // 5. Boarding (פנסיון ואירוח) - Default
  const startStr = formatDateYY(startDate);
  const endStr = formatDateYY(endDate);
  const datesStr = (endStr && endStr !== startStr) 
    ? `לתאריכים ${startStr} עד ${endStr}` 
    : (startStr ? `לתאריך ${startStr}` : '');

  return {
    serviceDescription: cleanDog
      ? `עבור שירותי פנסיון ל "${cleanDog}"${datesStr ? ` ${datesStr}` : ''}`
      : `עבור שירותי פנסיון${datesStr ? ` ${datesStr}` : ''}`,
    catalogItem: MORNING_CATALOG_ITEMS.BOARDING
  };
}

/**
 * Builds the exact two-row income array for Morning tax invoices / receipts (type 320):
 * Row 1: "הריזורט לכלב" | price: 0 (חיוב 0 שקלים)
 * Row 2: Service line | price: totalAmount
 */
export function buildMorningIncomeLines(params = {}) {
  const { serviceDescription, catalogItem } = buildMorningServiceDescription(params);
  const numAmount = Math.round(Number(params.amount) || 0);

  return [
    {
      itemId: MORNING_CATALOG_ITEMS.RESORT_DEFAULT.id,
      description: 'הריזורט לכלב',
      quantity: 1,
      price: 0,
      vatType: 1
    },
    {
      itemId: catalogItem.id,
      description: serviceDescription,
      quantity: 1,
      price: numAmount,
      vatType: 1
    }
  ];
}

/**
 * Synchronize customer to Morning and associate recent document
 */
export async function syncMorningCustomer({
  fullName,
  phone = '',
  email = '',
  amount = 0,
  transactionId = '',
  businessType = 'resort',
  serviceName = '',
  dogName = '',
  datesText = '',
  serviceType = 'boarding',
  startDate = '',
  endDate = '',
  extraDescription = '',
  passType = 'days',
  passCount = 10
}) {
  try {
    if (!fullName || !fullName.trim()) return null;
    const token = await getMorningToken();

    const cleanPhone = String(phone).replace(/\D/g, '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = fullName.trim();

    const { serviceDescription } = buildMorningServiceDescription({
      serviceType: serviceType || (serviceName ? (serviceName.includes('אילוף') ? 'training' : (serviceName.includes('יומי') ? 'daycare' : 'boarding')) : 'boarding'),
      dogName,
      startDate,
      endDate,
      extraDescription: extraDescription || (serviceName && !serviceName.includes('פנסיון') && !serviceName.includes('אירוח') && !serviceName.includes('אילוף') && !serviceName.includes('יומיות') ? serviceName : ''),
      passType,
      passCount
    });

    // Custom remarks on customer card
    const remarks = businessType === 'teacher_rights'
      ? (serviceName ? `זכויות המורה - ${serviceName}` : 'זכויות המורה')
      : `הריזורט לכלב | ${serviceDescription}`;

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

    // 2.5 If client exists, update client's remarks with exact Rule 36 service description
    if (client && client.id && remarks) {
      try {
        console.log(`[Morning] Updating existing client ${client.name} (${client.id}) remarks to: "${remarks}"...`);
        const updateRes = await fetch(`https://api.greeninvoice.co.il/api/v1/clients/${client.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ remarks })
        });
        if (updateRes.ok) {
          console.log(`[Morning] ✓ Successfully updated client remarks in Morning for ${client.name}`);
        } else {
          console.warn(`[Morning] Update client remarks returned status ${updateRes.status}`);
        }
      } catch (errUpdateClient) {
        console.warn('[Morning] Error updating client remarks:', errUpdateClient.message);
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

/**
 * Create official Tax Invoice Receipt (320) with strict 2-row layout:
 * Row 1: "הריזורט לכלב" | price: 0 (חיוב 0 שקלים)
 * Row 2: Service line | price: amount
 */
export async function createMorningTaxInvoiceReceipt({
  client,
  amount,
  serviceType,
  dogName,
  startDate,
  endDate,
  extraDescription,
  passType,
  passCount,
  paymentDetails = {}
}) {
  const token = await getMorningToken();
  const incomeLines = buildMorningIncomeLines({
    serviceType,
    dogName,
    startDate,
    endDate,
    extraDescription,
    passType,
    passCount,
    amount
  });

  const payload = {
    type: 320, // חשבונית מס / קבלה
    lang: 'he',
    currency: 'ILS',
    vatType: 0, // מסמך כולל מע"מ
    description: 'הריזורט לכלב',
    client: client?.id ? { id: client.id } : {
      name: client?.name || 'לקוח',
      emails: client?.email ? [client.email] : [],
      phone: client?.phone || '',
      taxId: client?.taxId || ''
    },
    income: incomeLines,
    payment: [
      {
        type: paymentDetails.type || 10,
        price: Number(amount),
        date: paymentDetails.date || new Date().toISOString().split('T')[0],
        ...(paymentDetails.appType ? { appType: paymentDetails.appType } : (paymentDetails.type === 10 ? { appType: 1 } : {})),
        ...(paymentDetails.transactionId ? { transactionId: String(paymentDetails.transactionId) } : {})
      }
    ]
  };

  const res = await fetch('https://api.greeninvoice.co.il/api/v1/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create Morning tax invoice receipt (${res.status}): ${errText}`);
  }

  const doc = await res.json();
  console.log(`[Morning] ✓ Successfully generated Tax Invoice Receipt #${doc.number} (${doc.id}) with 2-row layout!`);
  return doc;
}
