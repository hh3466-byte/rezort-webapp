const GROW_API_KEY = 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH';
const GROW_USER_ID = 'e1ceee55b717e60b';
const GROW_PAGE_CODE = '538cbf6f8827';
const GROW_BASE_URL = 'https://sandboxapi.grow.link';

async function testZeroProduct() {
  const payload = {
    userId: GROW_USER_ID,
    pageCode: GROW_PAGE_CODE,
    paymentLinkType: 2,
    isActive: 1,
    title: 'הריזורט לכלב',
    chargeType: 1,
    products: {
      data: [
        {
          name: 'הריזורט לכלב',
          price: 0,
          quantity: 1,
          vatType: 1
        },
        {
          name: 'בעבור אילוף ל "ליאו"',
          price: 1000,
          quantity: 1,
          vatType: 1
        }
      ]
    },
    pageFieldSettings: {
      fullName: { value: 'ישראל ישראלי' },
      phone: { value: '0501234567' }
    },
    paymentTypes: [{ type: 'payments', payments: { paymentsPaymentNum: 1 } }],
    transactionType: [1, 6, 13, 14, 5, 15]
  };

  const res = await fetch(GROW_BASE_URL + '/api/light/server/1.0/CreatePaymentLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': GROW_API_KEY },
    body: JSON.stringify(payload)
  });
  console.log('Grow status:', res.status);
  const data = await res.json();
  console.log('Grow response:', JSON.stringify(data, null, 2));
}
testZeroProduct();
