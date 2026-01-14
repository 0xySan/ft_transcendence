#!/usr/bin/env bash
set -euo pipefail

# Generates a self-signed certificate for localhost with SANs
# Usage: ./scripts/generate_local_certs.sh [IP|10]
# If an argument is provided it will be used as the IP SAN (e.g. 10.0.0.5).
# If the single argument `10` is passed, the script will use `10.0.0.1` to
# target the 10.X.X.X private range instead of 127.0.0.1.
# Outputs to ./certs/localhost.crt and ./certs/localhost.key

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT_DIR/certs"
mkdir -p "$OUT_DIR"

# Determine SAN IP: argument > SAN_PREFIX env var > default 127.0.0.1
if [ "$#" -ge 1 ]; then
  if [ "$1" = "10" ]; then
    SAN_IP="10.0.0.1"
  else
    SAN_IP="$1"
  fi
elif [ -n "${SAN_PREFIX:-}" ]; then
  if [ "${SAN_PREFIX}" = "10" ]; then
    SAN_IP="10.0.0.1"
  else
    SAN_IP="${SAN_PREFIX}"
  fi
else
  SAN_IP="127.0.0.1"
fi

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
IP.1 = ${SAN_IP}
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$OUT_DIR/localhost.key" \
  -out "$OUT_DIR/localhost.crt" \
  -config "$CFG"

chmod 644 "$OUT_DIR/localhost.crt"
chmod 600 "$OUT_DIR/localhost.key"
rm -f "$CFG"

echo "Certificates written to $OUT_DIR"
