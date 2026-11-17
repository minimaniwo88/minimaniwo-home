// Bootstrap for Abasthan (Node runtime, no Docker):
// 1) download xray-core release zip and extract the binary
// 2) render config.json from config.json.template using $UUID
// 3) spawn xray, then start the front-door server (server.js)
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

const XRAY_URL = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip';

function download(url, dest, redirects, done) {
  if (redirects > 5) { console.error('too many redirects'); process.exit(1); }
  https.get(url, { headers: { 'User-Agent': 'abasthan-node' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      download(res.headers.location, dest, redirects + 1, done);
      return;
    }
    if (res.statusCode !== 200) { console.error('download failed: HTTP ' + res.statusCode); process.exit(1); }
    const out = fs.createWriteStream(dest);
    res.pipe(out);
    out.on('finish', () => out.close(done));
  }).on('error', (e) => { console.error('download error: ' + e.message); process.exit(1); });
}

function ensureXray(done) {
  if (fs.existsSync('./xray')) { done(); return; }
  console.log('downloading xray-core...');
  download(XRAY_URL, './xray.zip', 0, () => {
    const zip = new AdmZip('./xray.zip');
    zip.extractEntryTo('xray', '.', false, true);
    fs.chmodSync('./xray', 0o755);
    fs.unlinkSync('./xray.zip');
    console.log('xray ready');
    done();
  });
}

function main() {
  let uuid = process.env.UUID;
  if (!uuid) {
    uuid = require('crypto').randomUUID();
    process.env.UUID = uuid;
    console.log('UUID env not set; generated for this boot: ' + uuid);
  }
  const tpl = fs.readFileSync('./config.json.template', 'utf8');
  fs.writeFileSync('./config.json', tpl.split('{{UUID}}').join(uuid));
  ensureXray(() => {
    const xray = spawn('./xray', ['run', '-config', './config.json'], { stdio: 'inherit' });
    xray.on('exit', (code) => { console.error('xray exited with code ' + code); process.exit(1); });
    require('./server.js');
  });
}

main();
