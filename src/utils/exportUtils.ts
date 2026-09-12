import { Booking, Customer, ResortSettings } from '../types';
import { formatDateIL } from './dateUtils';
import { getServiceTypeHebrew } from './whatsappUtils';

/**
 * Export Bookings to CSV (with UTF-8 BOM so Excel opens Hebrew properly)
 */
export function exportBookingsToCSV(bookings: Booking[], filename = 'יומן_הריזורט_הזמנות.csv'): void {
  const headers = [
    'מזהה',
    'שם הכלב',
    'גזע',
    'שם הבעלים',
    'טלפון',
    'סוג שירות',
    'תאריך התחלה',
    'תאריך סיום',
    'סה״כ לתשלום (₪)',
    'מקדמה ששולמה (₪)',
    'יתרה לתשלום (₪)',
    'סטטוס תשלום',
    'סטטוס שהות',
    'אמצעי תשלום',
    'חיסונים בתוקף',
    'הערות ומזון'
  ];

  const paymentStatusMap: Record<string, string> = {
    unpaid: 'לא שולם (חוב פתוח)',
    deposit_paid: 'שולמה מקדמה',
    fully_paid: 'שולם במלואו'
  };

  const stayStatusMap: Record<string, string> = {
    booked: 'מוזמן / עתידי',
    checked_in: 'שוהה בריזורט',
    checked_out: 'הסתיים / שוחרר',
    cancelled: 'בוטל'
  };

  const rows = bookings.map(b => {
    const remaining = Math.max(0, b.totalPrice - b.depositAmount);
    return [
      `"${b.id}"`,
      `"${b.dogName}"`,
      `"${b.dogBreed || ''}"`,
      `"${b.ownerName}"`,
      `"${b.ownerPhone}"`,
      `"${getServiceTypeHebrew(b.serviceType)}"`,
      `"${formatDateIL(b.startDate)}"`,
      `"${formatDateIL(b.endDate)}"`,
      b.totalPrice,
      b.depositAmount,
      remaining,
      `"${paymentStatusMap[b.paymentStatus] || b.paymentStatus}"`,
      `"${stayStatusMap[b.stayStatus] || b.stayStatus}"`,
      `"${b.paymentMethod || ''}"`,
      b.vaccinationValid ? 'כן' : 'לא',
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ];
  });

  // Calculate totals summary row
  const totalSum = bookings.reduce((acc, b) => acc + b.totalPrice, 0);
  const totalDeposit = bookings.reduce((acc, b) => acc + b.depositAmount, 0);
  const totalRemaining = totalSum - totalDeposit;

  const summaryRow = [
    '"סיכום כולל"',
    `"סה״כ ${bookings.length} הזמנות"`,
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    totalSum,
    totalDeposit,
    totalRemaining,
    '""',
    '""',
    '""',
    '""',
    '""'
  ];

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(r => r.join(',')),
    summaryRow.join(',')
  ].join('\r\n');

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Backup state as JSON file
 */
export function exportDataAsJSON(bookings: Booking[], settings: ResortSettings): void {
  const jsonStr = JSON.stringify({ bookings, settings }, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(jsonStr, `גיבוי_יומן_ריזורט_${dateStr}.json`, 'application/json');
}

export function exportBackupJSON(data: { bookings: Booking[]; settings: ResortSettings }): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(jsonStr, `גיבוי_יומן_ריזורט_${dateStr}.json`, 'application/json');
}

/**
 * Import and parse JSON backup file
 */
export function importDataFromJSON(file: File): Promise<{ bookings?: Booking[]; settings?: ResortSettings }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        resolve(parsed);
      } catch (err) {
        reject(new Error('קובץ JSON לא תקין'));
      }
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.readAsText(file);
  });
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ChartPeriodItem {
  periodKey: string;
  periodLabel: string;
  bookingsCount: number;
  totalCollected: number;
  totalExpected: number;
  openDebt: number;
}

/**
 * Export Revenue Graphs & Columns data to Excel (CSV with UTF-8 BOM for full Hebrew support)
 */
export function exportRevenueChartsToExcel(
  chartData: ChartPeriodItem[],
  bookings: Booking[],
  title = 'דוח_עמודות_הכנסות_וריזורט'
): void {
  const dateStr = new Date().toISOString().split('T')[0];

  const chartHeaders = [
    'תקופה',
    'כמות הזמנות',
    'הכנסות בפועל (₪)',
    'סה״כ שווי הזמנות (₪)',
    'יתרת חוב פתוחה (₪)',
    'אחוז גבייה בפועל'
  ];

  const chartRows = chartData.map(item => {
    const rate = item.totalExpected > 0
      ? Math.round((item.totalCollected / item.totalExpected) * 100)
      : 100;
    return [
      `"${item.periodLabel}"`,
      item.bookingsCount,
      item.totalCollected,
      item.totalExpected,
      item.openDebt,
      `"${rate}%"`
    ];
  });

  const sumCollected = chartData.reduce((s, i) => s + i.totalCollected, 0);
  const sumExpected = chartData.reduce((s, i) => s + i.totalExpected, 0);
  const sumDebt = chartData.reduce((s, i) => s + i.openDebt, 0);
  const sumBookings = chartData.reduce((s, i) => s + i.bookingsCount, 0);
  const overallRate = sumExpected > 0 ? Math.round((sumCollected / sumExpected) * 100) : 100;

  const chartSummaryRow = [
    '"סה״כ כולל"',
    sumBookings,
    sumCollected,
    sumExpected,
    sumDebt,
    `"${overallRate}%"`
  ];

  const detailHeaders = [
    'מזהה הזמנה',
    'שם הכלב',
    'גזע',
    'שם הבעלים',
    'טלפון',
    'סוג שירות',
    'תאריך התחלה',
    'תאריך סיום',
    'מחיר כולל (₪)',
    'נגבה בפועל (₪)',
    'חוב לתשלום (₪)',
    'סטטוס תשלום',
    'סטטוס שהות',
    'הערות'
  ];

  const detailRows = bookings.map(b => {
    const collected = b.paymentStatus === 'fully_paid' ? (Number(b.totalPrice) || 0) : (Number(b.depositAmount) || 0);
    const debt = Math.max(0, (Number(b.totalPrice) || 0) - collected);
    return [
      `"${b.id}"`,
      `"${b.dogName}"`,
      `"${b.dogBreed || ''}"`,
      `"${b.ownerName}"`,
      `"${b.ownerPhone}"`,
      `"${getServiceTypeHebrew(b.serviceType)}"`,
      `"${formatDateIL(b.startDate)}"`,
      `"${formatDateIL(b.endDate)}"`,
      Number(b.totalPrice) || 0,
      collected,
      debt,
      `"${b.paymentStatus === 'fully_paid' ? 'שולם במלואו' : debt > 0 ? 'חוב פתוח' : 'מקדמה'}"`,
      `"${b.stayStatus === 'checked_out' ? 'שוחרר' : b.stayStatus === 'checked_in' ? 'שוהה בריזורט' : 'מוזמן'}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ];
  });

  const lines = [
    `"דוח הכנסות היסטורי ונתוני גרפי עמודות - הריזורט לכלב"`,
    `"תאריך הפקה: ${formatDateIL(dateStr)}"`,
    '',
    `"--- סיכום עמודות הגרף (לפי חודשים/שנים) ---"`,
    chartHeaders.join(','),
    ...chartRows.map(r => r.join(',')),
    chartSummaryRow.join(','),
    '',
    `"--- פירוט כלל ההזמנות והתקבולים ---"`,
    detailHeaders.join(','),
    ...detailRows.map(r => r.join(','))
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  downloadFile(csvContent, `${title}_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

