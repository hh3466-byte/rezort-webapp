const cleanText = ` היי מגדל דנילוב בע"מ, אנחנו שמחים לעדכן אותך שבוצע תשלום של 2000 ש"ח. ממי התשלום שם: רונן מלמוד טלפון: 0524728843 מייל: roni876.rm@gmail.com עוד פרטים על העסקה סוג עסקה: רגיל אמצעי תשלום: Bit אשראי: 1234...Visa אסמכתא: 1234567 עבור שירות: `;

const subject = "בוצע תשלום עבור בעל העסק";
const sender = "<support@grow.security> grow";
const body = cleanText;
const htmlBody = cleanText;
const fullLower = (subject + " " + sender + " " + body + " " + htmlBody).toLowerCase();

const isMorning = sender.indexOf("morning") !== -1 ||
                sender.indexOf("greeninvoice") !== -1 ||
                subject.indexOf("morning") !== -1 ||
                subject.indexOf("חשבונית ירוקה") !== -1 ||
                subject.indexOf("חשבונית") !== -1;

const isGrow = sender.indexOf("grow") !== -1 ||
             sender.indexOf("meshulam") !== -1 ||
             subject.indexOf("בוצע תשלום עבור בעל העסק") !== -1 ||
             fullLower.indexOf("grow.business") !== -1 ||
             fullLower.indexOf("grow.link") !== -1;

console.log('isMorning:', isMorning);
console.log('isGrow:', isGrow);

const nameMatch = cleanText.match(/(?:ממי התשלום\s*[:\-]?\s*שם|שם המשלם|שם הלקוח|שם)\s*[:\-]?\s*([\u0590-\u05FFa-zA-Z]{2,15}(?:\s+[\u0590-\u05FFa-zA-Z]{2,15})?)/i) ||
                  cleanText.match(/עבור\s+([\u0590-\u05FFa-zA-Z]{2,15})/i);

const phoneMatch = cleanText.match(/(?:טלפון|נייד|סלולרי)\s*[:\-]?\s*([0-9+ -]{9,15})/i) ||
                 cleanText.match(/05[0-9][0-9 -]{7,10}/);
const amountMatch = cleanText.match(/(?:תשלום של|שולם|סכום)\s*(?:₪)?\s*([0-9.,]+)/i) ||
                  cleanText.match(/₪\s*([0-9.,]+)/) ||
                  cleanText.match(/([0-9.,]+)\s*₪/);
const refMatch = cleanText.match(/(?:אסמכתא|אישור|מספר אסמכתא)\s*[:\-]?\s*([0-9a-zA-Z]+)/i);

console.log('nameMatch:', nameMatch ? nameMatch[1] : null);
console.log('phoneMatch:', phoneMatch ? phoneMatch[0] : null);
console.log('amountMatch:', amountMatch ? amountMatch[1] : null);
console.log('refMatch:', refMatch ? refMatch[1] : null);

const isResortOrYaniv = fullLower.indexOf("הריזורט לכלב") !== -1 ||
                      fullLower.indexOf("הריזורט") !== -1 ||
                      fullLower.indexOf("ריזורט") !== -1 ||
                      fullLower.indexOf("יניב אלעד") !== -1 ||
                      fullLower.indexOf("ג'נגו") !== -1 ||
                      fullLower.indexOf("django") !== -1;
console.log('isResortOrYaniv:', isResortOrYaniv);
