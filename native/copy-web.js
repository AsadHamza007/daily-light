/* Copies the web app from the repo root into native/www so Capacitor can bundle it.
   Run after any change to the web app:  npm run copy:web  */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(__dirname, 'www');
const files = [
  'index.html', 'ilm.js', 'native-alarm.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png'
];
fs.mkdirSync(www, { recursive: true });
let n = 0;
files.forEach((f) => {
  const src = path.join(root, f);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(www, f)); n++; }
});
console.log('Copied ' + n + ' web files into ' + www);
