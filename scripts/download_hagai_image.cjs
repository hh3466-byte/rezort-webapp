const https = require('https');
const fs = require('fs');

const url = "https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/7e42957a-b831-4b50-863b-41c675346cda.jpg";
const dest = "scripts/bit_confirmation_luna.jpg";

const file = fs.createWriteStream(dest);
https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close(() => console.log('Successfully downloaded bit confirmation to scripts/bit_confirmation_luna.jpg'));
  });
}).on('error', (err) => {
  fs.unlink(dest, () => console.error(err));
});
