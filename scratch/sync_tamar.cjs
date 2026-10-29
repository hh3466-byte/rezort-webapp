const { syncMorningCustomer } = require('./test_morning_service.cjs');

async function syncTamar() {
  console.log('Syncing Tamar to Morning...');
  const res = await syncMorningCustomer({
    fullName: 'תמר גננית עם חיוך',
    phone: '0542188921',
    amount: 220,
    businessType: 'resort',
    dogName: 'ליידי'
  });
  console.log('Sync result:', res?.name, res?.id);
}

syncTamar();
