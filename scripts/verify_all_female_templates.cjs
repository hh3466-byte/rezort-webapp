const fs = require('fs');
const { DAILY_DOG_TEMPLATES, pickDailyDogTemplate } = require('../src/data/dailyDogTemplates');

console.log(`Scanning all ${DAILY_DOG_TEMPLATES.length} templates for female conversion...`);

const masculinePatterns = [
  /\bמטיס\b/,
  /\bאוהב\b/,
  /\bשוכב\b/,
  /\bישן\b/,
  /\bנרדם\b/,
  /\bנח\b/,
  /\bמסודר\b/,
  /\bשבע\b/,
  /\bמתגעגע\b/,
  /\bחושב\b/,
  /\bחוגג\b/,
  /\bשמח\b/,
  /\bמצטיין\b/,
  /\bמתקדם\b/,
  /\bממושמע\b/,
  /\bרציני\b/,
  /\bתלמיד\b/,
  /\bגאון\b/,
  /\bבוגר\b/,
  /\bמוכן\b/,
  /\bעייף\b/,
  /\bמפוקס\b/,
  /\bמרוכז\b/,
  /\bמשתולל\b/,
  /\bמתפנק\b/,
  /\bמתאמן\b/,
  /\bמתרגל\b/,
  /\bטייס\b/,
  /\bנסיך\b/,
  /\bמלך\b/
];

let issuesCount = 0;

DAILY_DOG_TEMPLATES.forEach(t => {
  const { formattedText } = pickDailyDogTemplate('שלומי', 'לונה', false, [], t.type === 'training', true);
  
  masculinePatterns.forEach(pattern => {
    if (pattern.test(formattedText)) {
      console.log(`⚠️ Issue in template #${t.id} (${t.type}): Found ${pattern} in:`);
      console.log(`   "${formattedText}"`);
      issuesCount++;
    }
  });
});

if (issuesCount === 0) {
  console.log(`✅ PERFECT: All ${DAILY_DOG_TEMPLATES.length} templates passed 100% female conversion check with 0 issues!`);
} else {
  console.log(`❌ Found ${issuesCount} issues to fix.`);
}
