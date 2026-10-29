const { syncMorningCustomer } = await import('../api/_morning-service.js');

const clientsToSync = [
  { fullName: 'קובי חלה', phone: '0523679637', amount: 360, dogName: 'ליידי' },
  { fullName: 'שני נחשון', phone: '0546474151', amount: 2100, dogName: 'צ׳ארלי' },
  { fullName: 'ניבה פורן', phone: '0507900781', amount: 360, dogName: 'שטוץ ודודו' }
];

async function syncAll() {
  for (const c of clientsToSync) {
    console.log(`Syncing ${c.fullName}...`);
    await syncMorningCustomer({
      fullName: c.fullName,
      phone: c.phone,
      amount: c.amount,
      businessType: 'resort',
      dogName: c.dogName
    });
  }
  console.log('All recent clients synced!');
}

syncAll();
