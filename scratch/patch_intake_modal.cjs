const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'IntakeRequestsModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Patch line 1441 and line 1451
const oldPrimary = "גזע: {req.dogBreed || 'מעורב'} {req.dogAge ? `| גיל: ${req.dogAge}` : ''} | {req.dogGender === 'female' ? 'נקבה' : 'זכר'} {req.isNeutered ? '(מסורס/מעוקרת)' : '(לא מסורס)'}";
const newPrimary = "גזע: {req.dogBreed || 'מעורב'} {req.dogAge ? `| גיל: ${req.dogAge}` : ''} | {req.dogGender === 'female' ? 'נקבה' : 'זכר'} {req.isNeutered === undefined ? '(טרם מולא)' : req.isNeutered ? '(מסורס/מעוקרת)' : req.dogGender === 'female' ? '(לא מעוקרת)' : '(לא מסורס)'}";

const oldAd = "גזע: {ad.dogBreed || 'מעורב'} {ad.dogAge ? `| גיל: ${ad.dogAge}` : ''} | {ad.dogGender === 'female' ? 'נקבה' : 'זכר'} {ad.isNeutered ? '(מסורס/מעוקרת)' : '(לא מסורס)'}";
const newAd = "גזע: {ad.dogBreed || 'מעורב'} {ad.dogAge ? `| גיל: ${ad.dogAge}` : ''} | {ad.dogGender === 'female' ? 'נקבה' : 'זכר'} {ad.isNeutered === undefined ? '(טרם מולא)' : ad.isNeutered ? '(מסורס/מעוקרת)' : ad.dogGender === 'female' ? '(לא מעוקרת)' : '(לא מסורס)'}";

if (content.includes(oldPrimary)) {
  content = content.replace(oldPrimary, newPrimary);
  console.log('Patched primary dog subtitle');
} else {
  console.warn('Could not find oldPrimary');
}

if (content.includes(oldAd)) {
  content = content.replace(oldAd, newAd);
  console.log('Patched additional dog subtitle');
} else {
  console.warn('Could not find oldAd');
}

// 2. Patch vetting badges for Neutered and Vaccinated
const oldNeuteredBadge = `{req.isNeutered ? 'כן ✂️' : (req.dogGender !== 'female' ? '❌ לא מסורס (₪230)' : '⚠️ לא מעוקרת')}`;
const newNeuteredBadge = `{req.isNeutered === undefined ? '⏳ טרם מולא' : req.isNeutered ? 'כן ✂️' : (req.dogGender !== 'female' ? '❌ לא מסורס (₪230)' : '⚠️ לא מעוקרת')}`;

const oldNeuteredColor = `req.isNeutered 
                          ? 'text-emerald-800' 
                          : req.dogGender !== 'female' 
                          ? 'text-red-900 font-extrabold' 
                          : 'text-amber-900 font-extrabold'`;

const newNeuteredColor = `req.isNeutered === undefined
                          ? 'text-slate-500 font-bold'
                          : req.isNeutered 
                          ? 'text-emerald-800' 
                          : req.dogGender !== 'female' 
                          ? 'text-red-900 font-extrabold' 
                          : 'text-amber-900 font-extrabold'`;

if (content.includes(oldNeuteredBadge)) {
  content = content.replace(oldNeuteredBadge, newNeuteredBadge);
  console.log('Patched Neutered badge text');
}

// Vaccinated badge
const oldVaccinatedBadge = `{req.isVaccinated ? 'כן 💉' : '🚨 חסר חיסון! ⚠️'}`;
const newVaccinatedBadge = `{req.isVaccinated === undefined ? '⏳ טרם מולא' : req.isVaccinated ? 'כן 💉' : '🚨 חסר חיסון! ⚠️'}`;

if (content.includes(oldVaccinatedBadge)) {
  content = content.replace(oldVaccinatedBadge, newVaccinatedBadge);
  console.log('Patched Vaccinated badge text');
}

// Vaccinated container styling
const oldVaccinatedContainer = `req.isVaccinated
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                        : 'bg-red-100 border-red-500 text-red-950 ring-2 ring-red-500/50 animate-pulse'`;

const newVaccinatedContainer = `req.isVaccinated === undefined
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : req.isVaccinated
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                        : 'bg-red-100 border-red-500 text-red-950 ring-2 ring-red-500/50 animate-pulse'`;

if (content.includes(oldVaccinatedContainer)) {
  content = content.replace(oldVaccinatedContainer, newVaccinatedContainer);
  console.log('Patched Vaccinated container styling');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished updating IntakeRequestsModal.tsx');
