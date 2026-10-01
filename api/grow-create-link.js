/**
 * =========================================================================
 * Grow (Meshulam) Create Dynamic Locked Payment Link API - הריזורט לכלב
 * Vercel Serverless Function: /api/grow-create-link
 * =========================================================================
 */

const GROW_API_KEY = process.env.GROW_API_KEY || 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH';
const GROW_USER_ID = process.env.GROW_USER_ID || 'e1ceee55b717e60b';
const GROW_PAGE_CODE = process.env.GROW_PAGE_CODE || '538cbf6f8827';
const GROW_BASE_URL = process.env.GROW_BASE_URL || 'https://sandboxapi.grow.link';

function cleanPhone(raw) {
  if (!raw) return '0500000000';
  let cleaned = String(raw).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  if (!cleaned.startsWith('05') || cleaned.length !== 10) return '0500000000';
  return cleaned;
}

export default async function handler(req, res) {
  // CORS & method check
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      amount,
      bookingId,
      dogName = 'כלב',
      ownerName = 'לקוח',
      ownerPhone = '',
      ownerEmail = '',
      description = '',
      successUrl = 'https://rezort-webapp.vercel.app/payment-success',
      notifyUrl = 'https://rezort-webapp.vercel.app/api/grow-webhook'
    } = req.body || {};

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount greater than 0 is required' });
    }

    const formattedPhone = cleanPhone(ownerPhone);
    const validFullName = (ownerName.trim().includes(' ') ? ownerName.trim() : `${ownerName.trim()} לקוח`).slice(0, 50);
    const itemTitle = description || `אירוח ופנסיון - ${dogName} (${validFullName})`;

    // Payload for Grow CreatePaymentLink (Locked Amount, only digital instant payments: Credit Card, Bit, Apple Pay, Google Pay, PayBox)
    const payload = {
      userId: GROW_USER_ID,
      pageCode: GROW_PAGE_CODE,
      paymentLinkType: 2, // Closed for one single payment with locked amount
      isActive: 1,
      title: `הריזורט לכלב - שריון עבור ${dogName}`,
      chargeType: 1,
      products: {
        data: [
          {
            name: itemTitle.slice(0, 70),
            price: Math.round(numAmount),
            quantity: 1,
            vatType: 1
          }
        ]
      },
      pageFieldSettings: {
        fullName: { value: validFullName },
        phone: { value: formattedPhone },
        ...(ownerEmail ? { email: { value: ownerEmail.trim() } } : {})
      },
      paymentTypes: [
        {
          type: 'payments',
          payments: {
            paymentsPaymentNum: 1
          }
        }
      ],
      // 1=Credit Card, 6=Bit, 13=Apple Pay, 14=Google Pay, 5=PayBox, 15=Bank Transfer (Managed via Grow with auto-invoice)
      transactionType: [1, 6, 13, 14, 5, 15],
      successUrl,
      notifyUrl,
      cField1: bookingId || `b-${Date.now()}`,
      cField2: formattedPhone
    };

    const endpointUrl = `${GROW_BASE_URL}/api/light/server/1.0/CreatePaymentLink`;
    console.log(`Calling Grow CreatePaymentLink (${endpointUrl}) for amount: ₪${numAmount}...`);

    const growRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GROW_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const responseData = await growRes.json();
    console.log('Grow response status:', growRes.status, 'Body:', JSON.stringify(responseData));

    if (responseData && responseData.status === 1 && responseData.data && responseData.data.url) {
      return res.status(200).json({
        success: true,
        paymentUrl: responseData.data.url,
        processId: responseData.data.paymentLinkProcessId,
        processToken: responseData.data.paymentLinkProcessToken,
        amount: numAmount
      });
    }

    // Fallback if Grow returns an error
    return res.status(200).json({
      success: false,
      error: responseData?.err?.message || 'שגיאה ביצירת קישור לתשלום מ-Grow',
      fallbackUrl: 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg'
    });

  } catch (err) {
    console.error('Error generating Grow payment link:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      fallbackUrl: 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg'
    });
  }
}
