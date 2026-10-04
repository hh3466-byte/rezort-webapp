/**
 * =========================================================================
 * Grow (Meshulam) Payment Service - הריזורט לכלב
 * Client-side integration for generating dynamic locked-amount payment links
 * =========================================================================
 */

export interface CreateGrowLinkParams {
  amount: number;
  bookingId?: string;
  dogName?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  description?: string;
}

export interface GrowLinkResponse {
  success: boolean;
  paymentUrl: string;
  isLocked: boolean;
  processId?: number;
  error?: string;
}

export const DEFAULT_FALLBACK_LINK = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
const GROW_API_KEY = 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH';
const GROW_USER_ID = 'e1ceee55b717e60b';
const GROW_PAGE_CODE = '538cbf6f8827';
const GROW_BASE_URL = 'https://sandboxapi.grow.link';

function cleanPhone(raw?: string): string {
  if (!raw) return '0500000000';
  let cleaned = String(raw).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  if (!cleaned.startsWith('05') || cleaned.length !== 10) return '0500000000';
  return cleaned;
}

/**
 * Generate a dynamic locked Grow payment link for a specific booking and amount.
 */
export async function createGrowDynamicPaymentLink(
  params: CreateGrowLinkParams
): Promise<GrowLinkResponse> {
  if (!params.amount || params.amount <= 0) {
    return {
      success: false,
      paymentUrl: DEFAULT_FALLBACK_LINK,
      isLocked: false,
      error: 'סכום התשלום חייב להיות גדול מ-0'
    };
  }

  // 1. Try serverless backend route first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch('/api/grow-create-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        return {
          success: true,
          paymentUrl: data.paymentUrl,
          isLocked: true,
          processId: data.processId
        };
      }
    }
  } catch (err: any) {
    console.warn('Grow serverless route notice:', err?.message || err);
  }

  // 2. Direct client-side Grow API fallback (guarantees dynamic locked link even in Vite dev or serverless cold-start)
  try {
    const numAmount = Math.round(Number(params.amount));
    const validFullName = ((params.ownerName || 'לקוח').trim().includes(' ') 
      ? (params.ownerName || 'לקוח').trim() 
      : `${(params.ownerName || 'לקוח').trim()} לקוח`).slice(0, 50);
    const itemTitle = params.description || `שריון אירוח בריזורט לכלב - ${params.dogName || 'כלב'}`;

    const payload = {
      userId: GROW_USER_ID,
      pageCode: GROW_PAGE_CODE,
      paymentLinkType: 2, // Locked amount
      isActive: 1,
      title: `הריזורט לכלב - ${params.dogName || 'שריון אירוח'}`,
      chargeType: 1,
      products: {
        data: [
          {
            name: itemTitle.slice(0, 70),
            price: numAmount,
            quantity: 1,
            vatType: 1
          }
        ]
      },
      pageFieldSettings: {
        fullName: { value: validFullName },
        phone: { value: cleanPhone(params.ownerPhone) },
        ...(params.ownerEmail ? { email: { value: params.ownerEmail.trim() } } : {})
      },
      paymentTypes: [
        {
          type: 'payments',
          payments: {
            paymentsPaymentNum: 1
          }
        }
      ],
      transactionType: [1, 6, 13, 14, 5, 15],
      successUrl: typeof window !== 'undefined' ? `${window.location.origin}/payment-success` : 'https://rezort-webapp.vercel.app/payment-success',
      notifyUrl: 'https://rezort-webapp.vercel.app/api/grow-webhook',
      cField1: params.bookingId || `b-${Date.now()}`,
      cField2: cleanPhone(params.ownerPhone)
    };

    const directController = new AbortController();
    const directTimeout = setTimeout(() => directController.abort(), 4000);

    const growRes = await fetch(`${GROW_BASE_URL}/api/light/server/1.0/CreatePaymentLink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': GROW_API_KEY
      },
      body: JSON.stringify(payload),
      signal: directController.signal
    });
    clearTimeout(directTimeout);

    if (growRes.ok) {
      const responseData = await growRes.json();
      if (responseData && responseData.status === 1 && responseData.data && responseData.data.url) {
        return {
          success: true,
          paymentUrl: responseData.data.url,
          isLocked: true,
          processId: responseData.data.paymentLinkProcessId
        };
      }
    }
  } catch (directErr: any) {
    console.warn('Direct Grow API fallback notice:', directErr?.message || directErr);
  }

  return {
    success: false,
    paymentUrl: DEFAULT_FALLBACK_LINK,
    isLocked: false,
    error: 'לא ניתן ליצור קישור דינמי כעת, נעשה שימוש בקישור ברירת המחדל'
  };
}
