const textWithBidi = "בוצע תשלום של \u202A2,000\u202C ש\"ח. ממי התשלום שם: רונן מלמוד טלפון: \u202A052-4728843\u202C";

const clean = textWithBidi
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&#8234;|&#x202a;|[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, " ")
  .replace(/\s+/g, " ");

const amountMatch = clean.match(/(?:תשלום של|שולם|סכום|סך|סה"כ)\s*(?:₪|ש"ח)?\s*([0-9.,]+)/i) ||
                    clean.match(/([0-9.,]+)\s*(?:₪|ש"ח)/);

const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
console.log('Cleaned text:', clean);
console.log('Amount matched:', amount);
