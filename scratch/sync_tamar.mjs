const { syncMorningCustomer } = await import('../api/_morning-service.js');

async function syncTamar() {
  console.log('Syncing Tamar to Morning using api/morning-service.js...');
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
