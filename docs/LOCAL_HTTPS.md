Local HTTPS (self-signed)
=========================

1) Generate certs (creates `./certs/localhost.crt` and `./certs/localhost.key`):

Default (127.0.0.1):
```bash
./scripts/generate_local_certs.sh 127.0.0.1 transcendence42.com
```

Use a 10.x IP (shorthand):
```bash
./scripts/generate_local_certs.sh 10 transcendence42.com
```

Use a specific IP:
```bash
./scripts/generate_local_certs.sh 10.1.2.3 transcendence42.com
```

2) Start Docker with the HTTPS override (this is optional — the normal compose stays HTTP):

```bash
docker-compose -f docker-compose.yml -f docker-compose.https.yml up --build
```

This will expose HTTPS on host port `8443` (container port 443). Visit https://localhost:8443 and accept the self-signed certificate in your browser.

3) Notes
- The HTTPS setup is opt-in via `docker-compose.https.yml` so machines that should not use HTTPS (or lack certs) can simply use the default `docker-compose.yml`.
- The generated cert is valid for `localhost` and `127.0.0.1` for 365 days.
