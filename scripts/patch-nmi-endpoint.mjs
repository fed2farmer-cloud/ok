import fs from 'node:fs';
import path from 'node:path';

const rawEnv = String(process.env.VITE_NMI_ENVIRONMENT || 'sandbox').trim().toLowerCase();
const isLive = rawEnv === 'live' || rawEnv === 'production';
const host = isLive ? 'secure.nmi.com' : 'sandbox.nmi.com';
const files = [
  'node_modules/@nmipayments/nmi-pay/dist/index.js',
  'node_modules/@nmipayments/nmi-pay/dist/index.cjs',
];

let patched = 0;
for (const relative of files) {
  const file = path.resolve(relative);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = before
    .replaceAll('https://secure.nmi.com/token/api/create', `https://${host}/token/api/create`)
    .replaceAll('https://sandbox.nmi.com/token/api/create', `https://${host}/token/api/create`);
  if (after !== before) {
    fs.writeFileSync(file, after);
    patched++;
  }
  if (!after.includes(`https://${host}/token/api/create`)) {
    throw new Error(`NMI token endpoint was not found in ${relative}`);
  }
}
if (patched === 0 && !files.some((f) => fs.existsSync(path.resolve(f)))) {
  throw new Error('NMI package is not installed; cannot patch token endpoint.');
}
console.log(`[SecuredLanding] NMI browser token endpoint: https://${host}/token/api/create`);
