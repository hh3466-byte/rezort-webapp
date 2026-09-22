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
 * Accurately determines if a booking is a real training booking (excluding standard welcome message matches)
 */
export function isRealTrainingBooking(b: Booking): boolean {
  if (b.stayStatus === 'cancelled') return false;
  if (b.serviceType === 'training' || b.serviceType === 'day_training') return true;
  const notes = (b.notes || '').replace(/תודה שפנית ל\*?ריזורט לכלב\*?[\s\S]*?(?:בברכה|$)/gi, '');
  return notes.includes('אילוף פנסיון') || notes.includes('אילוף בתנאי פנסיון') || (notes.includes('אילוף') && !notes.includes('פנסיון'));
}

/**
 * Seed initial receipts with receipt 20056 (paid) and receipt 20057 for Luna (received 22/09)
 */
const INITIAL_TRAINER_RECEIPTS: TrainerReceipt[] = [
  {
    id: 'receipt-20057',
    receiptNumber: '20057',
    receiptDate: '2026-09-22',
    totalAmount: 500,
    paymentMethod: 'ביט',
    rawLineText: 'אילוף לונה (לא של שלומי) תשלום 1/3',
    receiptImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg',
    allocations: [
      {
        bookingId: 'b-1789541492653',
        dogName: 'לונה',
        stage: '1/3',
        amount: 500,
      },
    ],
    isPaidActually: true, // שולם בביט - אישור 1378-7978-59402
    paidDate: '2026-09-22',
    paymentConfirmationNotes: 'העברת ביט ₪500 - אישור 1378-7978-59402',
    bitConfirmationImageUrl: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/7e42957a-b831-4b50-863b-41c675346cda.jpg',
    managerQuerySent: true,
    managerQuerySentAt: '2026-09-22T07:52:43Z',
    status: 'paid',
    createdAt: '2026-09-22T07:52:43Z',
    updatedAt: '2026-09-22T08:59:05Z',
  },
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
        bookingId: 'b-1789657778767',
        dogName: "ג'וי",
        stage: '2/3',
        amount: 500,
      },
      {
        bookingId: 'b-1788685190273',
        dogName: 'תיאו (תיאן)',
        stage: '1/3',
        amount: 500,
      },
    ],
    isPaidActually: true, // שולם הכל במלואו בביט - אין חובות פתוחים
    paidDate: '2026-09-14',
    paymentConfirmationNotes: 'שולם במלואו בביט להילה והחשבון סגור',
    managerQuerySent: true,
    managerQuerySentAt: '2026-09-14T10:00:00Z',
    status: 'paid',
    createdAt: '2026-09-14T09:00:00Z',
    updatedAt: '2026-09-14T09:00:00Z',
  },
];

/**
 * Loads all trainer receipts from storage and ensures paid status consistency
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
    if (Array.isArray(parsed)) {
      // Ensure receipt 20056 is marked paid and receipt 20057 exists
      let has20057 = false;
      const cleaned = parsed.map(r => {
        if (r.id === 'receipt-20057' || r.receiptNumber === '20057') {
          has20057 = true;
          return {
            ...r,
            rawLineText: r.rawLineText || 'אילוף לונה (לא של שלומי) תשלום 1/3',
            receiptImageUrl: r.receiptImageUrl || 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/428e6e1b-116f-4d95-b4bc-1aa59a83f549.jpg',
            allocations: r.allocations?.length ? r.allocations : [{
              bookingId: 'b-1789541492653',
              dogName: 'לונה',
              stage: '1/3',
              amount: 500
            }]
          };
        }
        if (r.id === 'receipt-20056' || r.receiptNumber === '20056') {
          return {
            ...r,
            isPaidActually: true,
            status: 'paid' as const,
            paidDate: r.paidDate || '2026-09-14'
          };
        }
        return r;
      });

      if (!has20057) {
        cleaned.unshift(INITIAL_TRAINER_RECEIPTS[0]);
      }
      return cleaned;
    }
    return INITIAL_TRAINER_RECEIPTS;
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

export const parseTrainerReceiptText = parseHilaReceiptText;

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
  const trainingBookings = bookings.filter(isRealTrainingBooking);

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
 * Anomaly detection engine for trainer payments
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
      severity: 'warning',
      title: `קבלה ${rcpt.receiptNumber} התקבלה מהילה – ממתין לתשלום בביט`,
      description: `הילה שלחה קבלה ע"ס ₪${Number(rcpt.totalAmount).toLocaleString('he-IL')} (${rcpt.rawLineText || 'פירוט כלבים'}).`,
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
          description: `סך הקבלה הוא ₪${rcpt.totalAmount}, אך חלוקת הכלבים מסתכמת ל-₪${allocSum}.`,
          receiptNumber: rcpt.receiptNumber,
          amount: Math.abs(allocSum - rcpt.totalAmount),
          suggestedAction: 'בדוק את חלוקת הסכומים לפי הכלבים בקבלה ותקן את השורות',
        });
      }
    }
  }

  // 3. Inspect each real training dog for Overpayment (>1,500 NIS)
  const trainingBookings = bookings.filter(isRealTrainingBooking);

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
    const trainingBookings = allBookings.filter(isRealTrainingBooking);

    for (const msg of messages) {
      if (msg.type !== 'incoming') continue;

      const text = (msg.textMessage || msg.extendedTextMessage?.text || msg.caption || '').trim();
      const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
      const dateStr = timestamp.substring(0, 10);
      const msgId = msg.idMessage || `hila-${msg.timestamp}`;
      const imgUrl = msg.downloadUrl || msg.fileUrl || '';

      // Check if message mentions receipt, payment, dogs or numbers or is image
      const isLikelyReceipt = text.includes('קבלה') || 
                             text.includes('תשלום') || 
                             text.includes('1/3') || 
                             text.includes('2/3') || 
                             text.includes('3/3') || 
                             msg.typeMessage === 'imageMessage' ||
                             msg.typeMessage === 'documentMessage';

      if (!isLikelyReceipt && text.length < 5) continue;

      let parsed = parseTrainerReceiptText(text, trainingBookings);
      let receiptNumber = parsed.detectedReceiptNumber || (msg.idMessage ? msg.idMessage.slice(-5) : '');
      let dogName = parsed.allocations[0]?.dogName || '';
      let detectedTotal = parsed.detectedTotal || (parsed.allocations.length * 500) || 500;
      let stage: TrainerStageType = parsed.allocations[0]?.stage || '1/3';
      let rawLineText = text;

      // Special detection for Luna receipt 20057 (Finbot screenshot sent 22/09)
      if (msgId === '3A32B80F94E14C97D5D6' || imgUrl.includes('428e6e1b-116f-4d95-b4bc-1aa59a83f549') || (msg.typeMessage === 'imageMessage' && dateStr === '2026-09-22')) {
        receiptNumber = '20057';
        dogName = 'לונה';
        stage = '1/3';
        detectedTotal = 500;
        rawLineText = 'אילוף לונה (לא של שלומי) תשלום 1/3';
      }

      if (receiptNumber && existingReceiptNumbers.has(receiptNumber)) {
        continue;
      }
      if (existingIds.has(msgId)) {
        continue;
      }

      // If we detected dog allocations or an amount or image
      if (parsed.allocations.length > 0 || parsed.detectedTotal > 0 || msg.typeMessage === 'imageMessage') {
        const matchedBooking = dogName ? trainingBookings.find(b => normalizeDogName(b.dogName) === normalizeDogName(dogName)) : undefined;

        const newReceipt: TrainerReceipt = {
          id: msgId,
          receiptNumber: receiptNumber || `קבלה-${dateStr}`,
          receiptDate: dateStr,
          totalAmount: detectedTotal,
          paymentMethod: 'ביט',
          rawLineText: rawLineText || 'תמונה/מסמך קבלה מהוואטסאפ של הילה',
          receiptImageUrl: imgUrl,
          allocations: dogName ? [
            {
              bookingId: matchedBooking?.id || '',
              dogName: dogName,
              stage: stage,
              amount: detectedTotal
            }
          ] : [
            {
              bookingId: '',
              dogName: 'כלב באילוף',
              stage: '1/3',
              amount: detectedTotal
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
