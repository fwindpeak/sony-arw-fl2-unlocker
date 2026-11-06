import fs from 'fs';
import { FlashRaw } from '/Users/kai/code/myprj/re-arw/web/node_modules/flashraw/dist/node.js';

async function run() {
  const buf = fs.readFileSync('/Users/kai/Downloads/DSC00526.ARW');
  const raw = await FlashRaw.open(buf);
  console.log('Opened ARW');
  const frame = await raw.decode({
    output: 'rgba8',
    demosaic: 'half-size',
    crop: true,
    exposure: 0.0
  });
  console.log('Decoded half-size frame:', frame.width, frame.height);
  
  // Save raw decoded buffer to disk for python analysis
  fs.writeFileSync('/tmp/raw_half.raw', Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
  console.log('Saved /tmp/raw_half.raw');
  raw.close();
}
run().catch(console.error);

