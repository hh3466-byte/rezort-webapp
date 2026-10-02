const fs = require('fs');
const path = require('path');

async function downloadReceipt() {
  const url = 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/77e36845-2d18-42dd-b977-8f1e2d78e1e3.jpeg';
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const filePath = path.join(__dirname, 'hila_receipt_downloaded.jpeg');
  fs.writeFileSync(filePath, Buffer.from(buffer));
  console.log('Saved to', filePath, 'Size:', buffer.byteLength);
}

downloadReceipt().catch(console.error);
