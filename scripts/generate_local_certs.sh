#!/usr/bin/env bash
set -euo pipefail

# Generates a self-signed certificate for localhost with SANs
# Outputs to ./certs/localhost.crt and ./certs/localhost.key

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/certs"
mkdir -p "$OUT_DIR"

CFG="$OUT_DIR/localhost.cnf"
cat > "$CFG" <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$OUT_DIR/localhost.key" \
  -out "$OUT_DIR/localhost.crt" \
  -config "$CFG"

chmod 644 "$OUT_DIR/localhost.crt"
chmod 600 "$OUT_DIR/localhost.key"
rm -f "$CFG"

echo "Certificates written to $OUT_DIR"
