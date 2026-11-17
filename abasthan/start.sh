#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
UUID="${UUID:?UUID env var required}"
WSPATH="${WS_PATH:-/ray}"
if [ ! -x ./xray ]; then
  echo "downloading xray-core..."
  curl -L -o xray.zip "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip"
  python3 -c "import zipfile; zipfile.ZipFile('xray.zip').extractall('.')"
  chmod +x ./xray
  rm -f xray.zip
fi
cat > config.json <<EOF
{
  "log": {"loglevel": "warning"},
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "port": ${PORT},
      "protocol": "vless",
      "settings": {
        "clients": [{"id": "${UUID}", "flow": ""}],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": {"path": "${WSPATH}"}
      }
    }
  ],
  "outbounds": [{"protocol": "freedom"}]
}
EOF
echo "starting xray on port ${PORT} path ${WSPATH}"
exec ./xray run -config config.json
