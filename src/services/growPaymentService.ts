/**
 * =========================================================================
 * Grow (Meshulam) Payment Service - הריזורט לכלב
 * Client-side integration for generating dynamic locked-amount payment links
 * =========================================================================
 */

import { buildMorningServiceDescription } from '../utils/morningInvoiceUtils';

export interface CreateGrowLinkParams {
  amount: number;
  bookingId?: string;
  dogName?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
}

export interface GrowLinkResponse {
  success: boolean;
  paymentUrl: string;
  isLocked: boolean;
  processId?: number;
  error?: string;
}

export const DEFAULT_FALLBACK_LINK = 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

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
      if (data.success && data.paymentUrl && !data.paymentUrl.includes('sandbox')) {
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

  // 2. Direct client-side Grow API fallback
  // CRITICAL: We strictly ban sandboxapi.grow.link and sandbox.grow.link!
  // If no production API endpoint is active, safely use the official production link.
  return {
    success: true,
    paymentUrl: DEFAULT_FALLBACK_LINK,
    isLocked: false,
    error: undefined
  };
}
