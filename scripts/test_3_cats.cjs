const ledger = [
  { ref: '4857277218', amount: 180, date: '2026-09-02', month: '2026-09' },
  { ref: '173760086', amount: 400, date: '2026-09-06', month: '2026-09' },
  { ref: '173783725', amount: 180, date: '2026-09-06', month: '2026-09' },
  { ref: '173758692', amount: 180, date: '2026-09-06', month: '2026-09' },
  { ref: '514721903', amount: 6300, date: '2026-09-06', month: '2026-09' },
  { ref: '515223561', amount: 360, date: '2026-09-07', month: '2026-09' },
  { ref: '174291549', amount: 540, date: '2026-09-10', month: '2026-09' },
  { ref: '516299998', amount: 2700, date: '2026-09-11', month: '2026-09' },
  { ref: '516703080', amount: 990, date: '2026-09-14', month: '2026-09' },
  { ref: '4888806968', amount: 108, date: '2026-09-14', month: '2026-09' },
  { ref: '517029357', amount: 540, date: '2026-09-15', month: '2026-09' },
  { ref: '517441750', amount: 720, date: '2026-09-16', month: '2026-09' },
  { ref: '517823870', amount: 1350, date: '2026-09-17', month: '2026-09' }
];
const growTotal = ledger.reduce((s, t) => s + t.amount, 0);
const bankTransfers = 6500;
const digitalTotal = growTotal + bankTransfers;
const cashNotes = 6648;
const grandTotal = digitalTotal + cashNotes;
console.log('1. נסלק החודש (דיגיטלי כולל):', digitalTotal);
console.log('2. יכנס לבנק ב-10 לחודש הקרוב (GROW):', growTotal);
console.log('3. נסלק במזומן (שטרות):', cashNotes);
console.log('סה"כ כולל:', grandTotal);
