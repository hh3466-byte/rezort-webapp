const fs = require('fs');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

async function run() {
  const phone = "972526340385@c.us";
  console.log(`Checking chat for ${phone}...`);

  try {
    const res = await globalThis.fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: phone, count: 20 })
    });
    const history = await res.json();
    console.log('Chat history for 0526340385:', JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Error fetching chat history:', err);
  }

  // Check Shmulik last outgoing
  try {
    const resShmulik = await globalThis.fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: "972506336896@c.us", count: 5 })
    });
    const shmulikHist = await resShmulik.json();
    console.log('Last messages to Shmulik (050-6336896):', JSON.stringify(shmulikHist, null, 2));
  } catch (err) {
    console.error('Error fetching Shmulik chat:', err);
  }

  // Check Hagai last outgoing
  try {
    const resHagai = await globalThis.fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: "972543200007@c.us", count: 5 })
    });
    const hagaiHist = await resHagai.json();
    console.log('Last messages to Hagai (054-3200007):', JSON.stringify(hagaiHist, null, 2));
  } catch (err) {
    console.error('Error fetching Hagai chat:', err);
  }
}

run();
