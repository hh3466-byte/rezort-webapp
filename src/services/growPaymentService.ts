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

const DEFAULT_FALLBACK_LINK = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

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

  try {
    const res = await fetch('/api/grow-create-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.paymentUrl) {
        return {
          success: true,
          paymentUrl: data.paymentUrl,
          isLocked: true,
          processId: data.processId
        };
      }
      if (data.fallbackUrl) {
        return {
          success: false,
          paymentUrl: data.fallbackUrl,
          isLocked: false,
          error: data.error
        };
      }
    }
  } catch (err: any) {
    console.warn('Grow dynamic link API call failed, falling back to default link:', err);
  }

  return {
    success: false,
    paymentUrl: DEFAULT_FALLBACK_LINK,
    isLocked: false,
    error: 'לא ניתן ליצור קישור דינמי כעת, נעשה שימוש בקישור ברירת המחדל'
  };
}
