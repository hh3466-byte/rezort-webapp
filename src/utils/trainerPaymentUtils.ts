import { Booking, TrainerPaymentStage, TrainerReceipt, TrainerStageType } from '../types';

export const HILA_TRAINER_INFO = {
  name: 'הילה קירזנר',
  businessName: 'Halodog',
  dealerNumber: '316132901',
  phone: '0526908943',
  address: 'שקד 40 חרמש 4489500',
  email: 'hila52k@gmail.com',
  totalPerDog: 1500,
  stageDefaultAmount: 500,
  managerNotificationPhone: '0543200007', // מספר המנהל לקבלת השאילתה
};

const TRAINER_RECEIPTS_STORAGE_KEY = 'dog_resort_trainer_receipts_v1';

/**
 * Creates default 3 payment stages for a training dog (1/3, 2/3, 3/3 of 500 NIS each).
 */
export function createDefaultTrainerStages(): TrainerPaymentStage[] {
  const now = new Date().toISOString();
  return [
    {
      stage: '1/3',
      label: 'תשלום 1/3 (ראשון)',
      amount: 500,
      isPaidActually: false,
      updatedAt: now,
    },
    {
      stage: '2/3',
      label: 'תשלום 2/3 (אמצע)',
      amount: 500,
      isPaidActually: false,
      updatedAt: now,
    },
    {
      stage: '3/3',
      label: 'תשלום 3/3 (סוף תשלום)',
      amount: 500,
      isPaidActually: false,
      updatedAt: now,
    },
  ];
}

/**
 * Ensures a training booking has properly initialized trainer stages.
 */
export function getBookingTrainerStages(booking: Booking): TrainerPaymentStage[] {
  const bData = (booking as any).data || {};
  if (booking.trainerStages && Array.isArray(booking.trainerStages) && booking.trainerStages.length > 0) {
    return booking.trainerStages;
  }
  if (bData.trainerStages && Array.isArray(bData.trainerStages) && bData.trainerStages.length > 0) {
    return bData.trainerStages;
  }
  return createDefaultTrainerStages();
}

/**
 * Seed initial receipts including receipt 20056 from Hila's sample
 */
const INITIAL_TRAINER_RECEIPTS: TrainerReceipt[] = [
  {
    id: 'receipt-20056',
    receiptNumber: '20056',
    receiptDate: '2026-09-14',
    totalAmount: 1000,
    paymentMethod: 'ביט',
    rawLineText: 'גוי תשלום 2/3 + תיאן תשלום 1/3',
    receiptImageUrl: '',
    allocations: [
      {
        bookingId: '',
        dogName: "ג'וי",
        stage: '2/3',
        amount: 500,
      },
      {
        bookingId: '',
        dogName: 'תיאו (תיאן)',
        stage: '1/3',
        amount: 500,
      },
    ],
    isPaidActually: false, // ממתין לאישור תשלום
    managerQuerySent: true,
    managerQuerySentAt: '2026-09-14T10:00:00Z',
    status: 'pending_payment',
    createdAt: '2026-09-14T09:00:00Z',
    updatedAt: '2026-09-14T09:00:00Z',
  },
];

/**
 * Loads all trainer receipts from storage
 */
export function getTrainerReceipts(): TrainerReceipt[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return INITIAL_TRAINER_RECEIPTS;
  }
  try {
    const raw = localStorage.getItem(TRAINER_RECEIPTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TRAINER_RECEIPTS_STORAGE_KEY, JSON.stringify(INITIAL_TRAINER_RECEIPTS));
      return INITIAL_TRAINER_RECEIPTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TRAINER_RECEIPTS;
  } catch {
    return INITIAL_TRAINER_RECEIPTS;
  }
}

/**
 * Saves all trainer receipts to local storage
 */
export function saveTrainerReceipts(receipts: TrainerReceipt[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(TRAINER_RECEIPTS_STORAGE_KEY, JSON.stringify(receipts));
  } catch (e) {
    console.error('Failed to save trainer receipts:', e);
  }
}

/**
 * Normalizes dog name for matching (removes quotes, apostrophes, spaces)
 */
export function normalizeDogName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/['"״׳`\s]/g, '')
    .trim();
}

/**
 * Matches a dog name from receipt text against available training bookings.
 */
export function matchDogFromText(text: string, trainingBookings: Booking[]): Booking | undefined {
  const clean = normalizeDogName(text);
  if (!clean) return undefined;

  // Exact or contains match
  for (const b of trainingBookings) {
    const bClean = normalizeDogName(b.dogName);
    if (bClean === clean || clean.includes(bClean) || bClean.includes(clean)) {
      return b;
    }
    // Handle Joy / גוי / ג'וי
    if ((clean.includes('גוי') || clean.includes('גלי')) && (bClean.includes('גוי') || bClean.includes('גלי'))) {
      return b;
    }
    // Handle Tian / Theo / תיאן / תיאו
    if ((clean.includes('תיאן') || clean.includes('תיאו')) && (bClean.includes('תיאו') || bClean.includes('תיאן'))) {
      return b;
    }
  }
  return undefined;
}

/**
 * Parses raw text from Hila's receipt or message to automatically classify dogs and stages.
 * Example input: "גוי תשלום 2/3 + תיאן תשלום 1/3"
 */
export function parseHilaReceiptText(
  rawText: string,
  trainingBookings: Booking[]
): {
  detectedReceiptNumber?: string;
  detectedTotal?: number;
  allocations: { booking?: Booking; dogName: string; stage: TrainerStageType; amount: number }[];
} {
  const resultAllocations: { booking?: Booking; dogName: string; stage: TrainerStageType; amount: number }[] = [];

  // 1. Extract receipt number if present
  let detectedReceiptNumber: string | undefined;
  const numMatch = rawText.match(/(?:קבלה|מספר|מס'|חשבונית)\s*[:#]?\s*(\d+)/i);
  if (numMatch) {
    detectedReceiptNumber = numMatch[1];
  }

  // 2. Extract total amount if present
  let detectedTotal: number | undefined;
  const totalMatch = rawText.match(/(?:סה["״]?כ|שולם|סך)\s*[:=]?\s*₪?\s*([\d,]+(?:\.\d+)?)/i);
  if (totalMatch) {
    detectedTotal = Number(totalMatch[1].replace(/,/g, ''));
  }

  // 3. Split by lines or '+' or ','
  const parts = rawText.split(/[+\n,;]|\s+ו(?=[\u0590-\u05FF])/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Detect stage (1/3, 2/3, 3/3)
    let stage: TrainerStageType = '1/3';
    if (trimmed.includes('2/3') || trimmed.includes('2 מתוך 3') || trimmed.includes('שני')) {
      stage = '2/3';
    } else if (trimmed.includes('3/3') || trimmed.includes('3 מתוך 3') || trimmed.includes('שלישי') || trimmed.includes('סוף')) {
      stage = '3/3';
    } else if (trimmed.includes('1/3') || trimmed.includes('1 מתוך 3') || trimmed.includes('ראשון')) {
      stage = '1/3';
    }

    // Try matching dog name
    const matchedDog = matchDogFromText(trimmed, trainingBookings);
    let dogName = matchedDog?.dogName || '';

    if (!dogName) {
      // Clean word attempts
      const words = trimmed.replace(/[0-9/.,+]/g, '').replace(/תשלום/g, '').trim().split(/\s+/);
      dogName = words[0] || '';
    }

    if (dogName) {
      resultAllocations.push({
        booking: matchedDog,
        dogName,
        stage,
        amount: 500, // standard 500 NIS per stage
      });
    }
  }

  return {
    detectedReceiptNumber,
    detectedTotal: detectedTotal || (resultAllocations.length * 500),
    allocations: resultAllocations,
  };
}

/**
 * Formats the WhatsApp question to be sent directly to the Manager (054-3200007)
 */
export function formatManagerReceiptQuery(receipt: TrainerReceipt): string {
  const dogLines = receipt.allocations
    .map(a => `• *${a.dogName}*: שלב ${a.stage} (₪${a.amount.toLocaleString('he-IL')})`)
    .join('\n');

  return `🐾 *התקבלה קבלה חדשה מהילה המאלפת (Halodog)*
📋 *קבלה מס':* ${receipt.receiptNumber}
📅 *תאריך קבלה:* ${receipt.receiptDate}
💰 *סך בקבלה:* ₪${receipt.totalAmount.toLocaleString('he-IL')} (${receipt.paymentMethod || 'ביט'})

🐕 *שיוך כלבים שסווג אוטומטית:*
${dogLines}

❓ *האם שולם בפועל וכמה?*
אנא השב כאן עם סכום/אמצעי התשלום, או שלח צילום אישור תשלום ביט לוואטסאפ של הריזורט לתיוק מיידי וסגירת החשבון.`;
}

/**
 * Applies a receipt to bookings:
 * - Updates stage payment & receipt info
 * - If stage is '3/3': marks training as completed!
 */
export function applyReceiptToBookings(
  receipt: TrainerReceipt,
  allBookings: Booking[]
): { updatedBookings: Booking[]; completedDogs: string[] } {
  const completedDogs: string[] = [];
  const updatedBookings = allBookings.map(b => {
    // Check if this booking is allocated in the receipt
    const alloc = receipt.allocations.find(a => 
      (a.bookingId && a.bookingId === b.id) ||
      normalizeDogName(a.dogName) === normalizeDogName(b.dogName)
    );

    if (!alloc) return b;

    const stages = getBookingTrainerStages(b);
    const updatedStages = stages.map(st => {
      if (st.stage === alloc.stage) {
        return {
          ...st,
          amount: alloc.amount,
          receiptNumber: receipt.receiptNumber,
          receiptDate: receipt.receiptDate,
          receiptImageUrl: receipt.receiptImageUrl || st.receiptImageUrl,
          isPaidActually: receipt.isPaidActually,
          paidDate: receipt.isPaidActually ? (receipt.paidDate || receipt.receiptDate) : st.paidDate,
          paymentMethod: (receipt.paymentMethod === 'ביט' ? 'bit' : 'bank_transfer') as any,
          paymentConfirmationUrl: receipt.paymentConfirmationUrl || st.paymentConfirmationUrl,
          notes: receipt.paymentConfirmationNotes || st.notes,
          updatedAt: new Date().toISOString(),
        };
      }
      return st;
    });

    // Check if stage 3/3 is reached -> graduation to "הסתיים האילוף"
    const hasStage3 = updatedStages.some(st => st.stage === '3/3' && (st.receiptNumber || st.isPaidActually));
    const isCompleted = hasStage3 || b.isTrainingCompleted;

    if (hasStage3 && !b.isTrainingCompleted) {
      completedDogs.push(b.dogName);
    }

    return {
      ...b,
      trainerStages: updatedStages,
      isTrainingCompleted: isCompleted,
      trainingCompletedAt: hasStage3 ? (b.trainingCompletedAt || receipt.receiptDate || new Date().toISOString()) : b.trainingCompletedAt,
      updatedAt: new Date().toISOString(),
    };
  });

  return { updatedBookings, completedDogs };
}

/**
 * Computes summary KPI metrics for Hila's payments
 */
export function computeTrainerMetrics(bookings: Booking[], receipts: TrainerReceipt[]) {
  const trainingBookings = bookings.filter(b => 
    b.serviceType === 'training' || 
    b.serviceType === 'day_training' || 
    (b.notes || '').includes('אילוף')
  );

  const activeTrainingDogs = trainingBookings.filter(b => !b.isTrainingCompleted);
  const completedTrainingDogs = trainingBookings.filter(b => b.isTrainingCompleted);

  // Total paid actually from receipts
  const totalPaidActually = receipts
    .filter(r => r.isPaidActually)
    .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  // Receipts pending payment (Hila sent receipt ahead of time!)
  const pendingPaymentReceipts = receipts.filter(r => !r.isPaidActually);
  const totalPendingPaymentAmount = pendingPaymentReceipts
    .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  // Total commitment for active dogs (each dog is 1,500 NIS minus what is already paid)
  let totalRemainingLiability = 0;
  for (const dog of activeTrainingDogs) {
    const stages = getBookingTrainerStages(dog);
    const paidForDog = stages
      .filter(s => s.isPaidActually)
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    totalRemainingLiability += Math.max(0, HILA_TRAINER_INFO.totalPerDog - paidForDog);
  }

  return {
    totalTrainingDogs: trainingBookings.length,
    activeTrainingDogsCount: activeTrainingDogs.length,
    completedTrainingDogsCount: completedTrainingDogs.length,
    totalPaidActually,
    pendingPaymentReceiptsCount: pendingPaymentReceipts.length,
    totalPendingPaymentAmount,
    totalRemainingLiability,
  };
}

export interface TrainerAnomaly {
  id: string;
  type: 'overpayment' | 'unpaid_receipt' | 'missing_receipt' | 'amount_mismatch' | 'delayed_payment' | 'orphan_dog';
  severity: 'error' | 'warning';
  title: string;
  description: string;
  dogName?: string;
  bookingId?: string;
  receiptNumber?: string;
  amount?: number;
  suggestedAction: string;
}

/**
 * Robust anomaly detection engine:
 * 1. Checks for Unpaid Receipts (Hila sent receipt in advance out of trust, resort hasn't paid yet!)
 * 2. Overpayments beyond 1,500 NIS per dog
 * 3. Paid stages with missing receipts
 * 4. Discrepancies between receipt total and dog stage breakdown
 * 5. Completed dogs with unpaid remaining balance
 */
export function detectTrainerPaymentAnomalies(
  bookings: Booking[],
  receipts: TrainerReceipt[]
): TrainerAnomaly[] {
  const anomalies: TrainerAnomaly[] = [];

  // 1. Check for Unpaid Receipts (Hila sent receipt in advance out of trust, but resort hasn't paid yet!)
  const unpaidReceipts = receipts.filter(r => !r.isPaidActually);
  for (const rcpt of unpaidReceipts) {
    anomalies.push({
      id: `unpaid-${rcpt.id}`,
      type: 'unpaid_receipt',
      severity: 'error',
      title: `קבלה ${rcpt.receiptNumber} התקבלה מהילה – טרם שולם בביט!`,
      description: `הילה שלחה קבלה ע"ס ₪${Number(rcpt.totalAmount).toLocaleString('he-IL')} (${rcpt.rawLineText || 'פירוט כלבים'}), אך התשלום בפועל בביט טרם בוצע או אושר.`,
      receiptNumber: rcpt.receiptNumber,
      amount: rcpt.totalAmount,
      suggestedAction: 'יש לבצע העברה בביט להילה (052-6908943) ולסמן "שולם בביט"',
    });
  }

  // 2. Check for Receipts with Amount Mismatch (Sum of allocations != totalAmount)
  for (const rcpt of receipts) {
    if (rcpt.allocations && rcpt.allocations.length > 0) {
      const allocSum = rcpt.allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
      if (Math.abs(allocSum - Number(rcpt.totalAmount)) > 1) {
        anomalies.push({
          id: `mismatch-${rcpt.id}`,
          type: 'amount_mismatch',
          severity: 'warning',
          title: `אי-התאמה בסכום קבלה ${rcpt.receiptNumber}`,
          description: `סך הקבלה הוא ₪${rcpt.totalAmount}, אך חלוקת הכלבים מסתכמת ל-₪${allocSum} (הפרש של ₪${Math.abs(allocSum - rcpt.totalAmount)}).`,
          receiptNumber: rcpt.receiptNumber,
          amount: Math.abs(allocSum - rcpt.totalAmount),
          suggestedAction: 'בדוק את חלוקת הסכומים לפי הכלבים בקבלה ותקן את השורות',
        });
      }
    }
  }

  // 3. Inspect each training dog for Overpayment (>1,500 NIS) or Missing Stages
  const trainingBookings = bookings.filter(b => 
    b.serviceType === 'training' || 
    b.serviceType === 'day_training' || 
    (b.notes || '').includes('אילוף')
  );

  for (const dog of trainingBookings) {
    const stages = getBookingTrainerStages(dog);
    const paidStages = stages.filter(s => s.isPaidActually);
    const totalPaid = paidStages.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    // 3a. Overpayment check (>1,500 NIS)
    if (totalPaid > HILA_TRAINER_INFO.totalPerDog) {
      anomalies.push({
        id: `overpay-${dog.id}`,
        type: 'overpayment',
        severity: 'error',
        title: `חריגת תשלום עבור ${dog.dogName}: שולמו ₪${totalPaid} (מעל התקרה של ₪1,500)!`,
        description: `שולמו להילה ₪${totalPaid} עבור ${dog.dogName}, כאשר ההסכם המלא הוא ₪1,500 לכלב באילוף. חריגה של ₪${totalPaid - HILA_TRAINER_INFO.totalPerDog}!`,
        dogName: dog.dogName,
        bookingId: dog.id,
        amount: totalPaid - HILA_TRAINER_INFO.totalPerDog,
        suggestedAction: 'בדוק כפילות קבלות או קזז את ההפרש מהתשלום הבא להילה',
      });
    }

    // 3b. Paid without receipt (Paid actually = true, but receiptNumber is missing)
    for (const st of stages) {
      if (st.isPaidActually && !st.receiptNumber) {
        anomalies.push({
          id: `no-rcpt-${dog.id}-${st.stage}`,
          type: 'missing_receipt',
          severity: 'warning',
          title: `חסרה קבלה מהילה: ${dog.dogName} (שלב ${st.stage})`,
          description: `נרשם תשלום בפועל של ₪${st.amount} לשלב ${st.stage}, אך לא הוצמדה קבלה תואמת מהילה.`,
          dogName: dog.dogName,
          bookingId: dog.id,
          amount: st.amount,
          suggestedAction: 'בקש מהילה לשלוח קבלה עבור שלב זה',
        });
      }
    }

    // 3c. Completed dog without full payment
    if (dog.isTrainingCompleted && totalPaid < HILA_TRAINER_INFO.totalPerDog) {
      anomalies.push({
        id: `underpay-completed-${dog.id}`,
        type: 'delayed_payment',
        severity: 'warning',
        title: `האילוף של ${dog.dogName} הסתיים, אך נותרה יתרה להילה של ₪${HILA_TRAINER_INFO.totalPerDog - totalPaid}!`,
        description: `כלב זה השלים את תקופת האילוף (או סומן כהסתיים), אך שולמו למאלפת הילה רק ₪${totalPaid} מתוך ₪1,500. נותרה יתרה פתוחה להילה בסך ₪${HILA_TRAINER_INFO.totalPerDog - totalPaid}.`,
        suggestedAction: 'הסדר את תשלום 3/3 מול הילה לסגירת החשבון',
      });
    }
  }

  return anomalies;
}

/**
 * Automatically fetches and parses incoming receipts from Hila's WhatsApp chat (052-690-8943)
 */
export async function syncTrainerReceiptsFromWhatsAppChat(
  settings: any,
  allBookings: Booking[]
): Promise<{ newReceiptsCount: number; receipts: TrainerReceipt[] }> {
  const greenId = settings?.greenApiIdInstance?.trim();
  const greenToken = settings?.greenApiToken?.trim();
  if (!greenId || !greenToken) {
    return { newReceiptsCount: 0, receipts: getTrainerReceipts() };
  }

  const hilaChatId = '972526908943@c.us';

  try {
    const res = await fetch(`https://api.green-api.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: hilaChatId, count: 50 })
    });

    if (!res.ok) {
      return { newReceiptsCount: 0, receipts: getTrainerReceipts() };
    }

    const messages = await res.json();
    if (!Array.isArray(messages)) {
      return { newReceiptsCount: 0, receipts: getTrainerReceipts() };
    }

    const currentReceipts = getTrainerReceipts();
    const existingIds = new Set(currentReceipts.map(r => r.id));
    const existingReceiptNumbers = new Set(currentReceipts.map(r => r.receiptNumber).filter(Boolean));

    let newCount = 0;
    const trainingBookings = allBookings.filter(b => 
      b.serviceType === 'training' || 
      b.serviceType === 'day_training' || 
      (b.notes || '').includes('אילוף')
    );

    for (const msg of messages) {
      if (msg.type !== 'incoming') continue;

      const text = (msg.textMessage || msg.extendedTextMessage?.text || msg.caption || '').trim();
      const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
      const dateStr = timestamp.substring(0, 10);
      const msgId = msg.idMessage || `hila-${msg.timestamp}`;

      // Check if message mentions receipt, payment, dogs or numbers
      const isLikelyReceipt = text.includes('קבלה') || 
                             text.includes('תשלום') || 
                             text.includes('1/3') || 
                             text.includes('2/3') || 
                             text.includes('3/3') || 
                             msg.typeMessage === 'imageMessage' ||
                             msg.typeMessage === 'documentMessage';

      if (!isLikelyReceipt && text.length < 5) continue;

      const parsed = parseTrainerReceiptText(text, trainingBookings);
      const receiptNumber = parsed.detectedReceiptNumber || (msg.idMessage ? msg.idMessage.slice(-5) : '');

      if (receiptNumber && existingReceiptNumbers.has(receiptNumber)) {
        continue;
      }
      if (existingIds.has(msgId)) {
        continue;
      }

      // If we detected dog allocations or an amount or image
      if (parsed.allocations.length > 0 || parsed.detectedTotal > 0 || msg.typeMessage === 'imageMessage') {
        const newReceipt: TrainerReceipt = {
          id: msgId,
          receiptNumber: receiptNumber || `קבלה-${dateStr}`,
          receiptDate: dateStr,
          totalAmount: parsed.detectedTotal || (parsed.allocations.length * 500) || 500,
          paymentMethod: 'ביט',
          rawLineText: text || 'תמונה/מסמך קבלה מהוואטסאפ של הילה',
          receiptImageUrl: msg.downloadUrl || msg.fileUrl || '',
          allocations: parsed.allocations.length > 0 ? parsed.allocations.map(a => ({
            bookingId: a.booking?.id || '',
            dogName: a.dogName,
            stage: a.stage,
            amount: a.amount
          })) : [
            {
              bookingId: '',
              dogName: 'כלב באילוף',
              stage: '1/3',
              amount: parsed.detectedTotal || 500
            }
          ],
          isPaidActually: false,
          managerQuerySent: true,
          managerQuerySentAt: timestamp,
          status: 'pending_payment',
          createdAt: timestamp,
          updatedAt: timestamp
        };

        currentReceipts.unshift(newReceipt);
        existingIds.add(msgId);
        if (receiptNumber) existingReceiptNumbers.add(receiptNumber);
        newCount++;
      }
    }

    if (newCount > 0) {
      saveTrainerReceipts(currentReceipts);
    }

    return { newReceiptsCount: newCount, receipts: currentReceipts };
  } catch (err) {
    console.warn('syncTrainerReceiptsFromWhatsAppChat error:', err);
    return { newReceiptsCount: 0, receipts: getTrainerReceipts() };
  }
}
