// Front door for the Abasthan xray deployment.
// - Serves token-protected subscription links (VMess for Surge-style import,
//   VLESS link for Shadowrocket etc.).
// - Proxies WebSocket upgrades to the local xray inbounds.
// - Everything else returns HTTP 400.
const http = require('http');
const net = require('net');

const PORT = process.env.PORT || 8080;
const UUID = process.env.UUID || '';
const SUB_TOKEN = process.env.SUB_TOKEN || '';

const VMESS_PORT = 10001;
const VLESS_PORT = 10002;
const VMESS_PATH = '/ws-vmess';
const VLESS_PATH = '/ws-vless';

function publicHost(req) {
  return (req.headers && req.headers.host) || 'localhost';
}

function vmessLink(req) {
  const host = publicHost(req);
  const cfg = {
    v: '2', ps: 'Abasthan-VMess', add: host, port: '443', id: UUID,
    aid: '0', scy: 'auto', net: 'ws', type: 'none', host: host,
    path: VMESS_PATH, tls: 'tls', sni: host, alpn: ''
  };
  return 'vmess://' + Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64');
}

function vlessLink(req) {
  const host = publicHost(req);
  const q = 'encryption=none&security=tls&type=ws&host=' + encodeURIComponent(host) +
    '&path=' + encodeURIComponent(VLESS_PATH) + '&sni=' + encodeURIComponent(host);
  return 'vless://' + UUID + '@' + host + ':443?' + q + '#Abasthan-VLESS';
}

function surgeConfig(req) {
  const host = publicHost(req);
  return [
    '[Proxy]',
    'Abasthan-VMess = vmess, ' + host + ', 443, username=' + UUID +
      ', ws=true, ws-path=' + VMESS_PATH + ', ws-headers=Host:"' + host + '", tls=true, sni=' + host,
    '',
    '[Proxy Group]',
    'Proxy = select, Abasthan-VMess, DIRECT',
    '',
    '[Rule]',
    'FINAL,Proxy',
    ''
  ].join('\n');
}

function tokenOk(req) {
  if (!SUB_TOKEN) return false;
  try {
    const u = new URL(req.url, 'http://internal');
    return u.searchParams.get('t') === SUB_TOKEN;
  } catch (e) {
    return false;
  }
}

const server = http.createServer((req, res) => {
  let pathname = '/';
  try { pathname = new URL(req.url, 'http://internal').pathname; } catch (e) {}

  if (pathname === '/tk-rail') {
    if (!tokenOk(req)) { res.writeHead(403); res.end('forbidden'); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(Buffer.from(vmessLink(req), 'utf8').toString('base64'));
    return;
  }
  if (pathname === '/tk-vless') {
    if (!tokenOk(req)) { res.writeHead(403); res.end('forbidden'); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(Buffer.from(vlessLink(req), 'utf8').toString('base64'));
    return;
  }
  if (pathname === '/tk-surge') {
    if (!tokenOk(req)) { res.writeHead(403); res.end('forbidden'); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(surgeConfig(req));
    return;
  }
  res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('bad request');
});

server.on('upgrade', (req, socket, head) => {
  let pathname = '';
  try { pathname = new URL(req.url, 'http://internal').pathname; } catch (e) {}
  let target = null;
  if (pathname === VMESS_PATH) target = VMESS_PORT;
  else if (pathname === VLESS_PATH) target = VLESS_PORT;
  if (!target) { socket.destroy(); return; }

  const backend = net.connect(target, '127.0.0.1', () => {
    const lines = [req.method + ' ' + req.url + ' HTTP/' + req.httpVersion];
    const raw = req.rawHeaders || [];
    for (let i = 0; i + 1 < raw.length; i += 2) lines.push(raw[i] + ': ' + raw[i + 1]);
    backend.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) backend.write(head);
    backend.pipe(socket);
    socket.pipe(backend);
  });
  backend.on('error', () => socket.destroy());
  socket.on('error', () => backend.destroy());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('front door listening on ' + PORT);
});
