# Abasthan free-tier node

VLESS / VMess over WebSocket on the Abasthan PaaS free plan (512 MB / 0.1 vCPU).
A small Node front door (server.js) listens on the platform PORT, serves
token-protected subscription links and proxies WebSocket upgrades to a local
xray-core (downloaded on first boot by run.js).

Deploy settings:
- Root directory: `abasthan`
- Runtime: Node.js 20+
- Build command: `npm install`
- Start command: `node run.js`
- Instance: Free
- Env vars: `UUID` (client id), `SUB_TOKEN` (subscription link token)

Client endpoints (after deploy, host = the app's .abasthan.app subdomain):
- VLESS subscription: `https://<host>/tk-vless?t=<SUB_TOKEN>`
- VMess subscription: `https://<host>/tk-rail?t=<SUB_TOKEN>`
- WS paths: `/ws-vless`, `/ws-vmess` on port 443 (TLS at the platform edge)
