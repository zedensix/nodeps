---
title: Behind nginx
description: Run the binary as a server and proxy to it.
order: 1
icon: network
byline: The nodeps maintainers
resources:
  - path: files/nginx.conf
    description: Reverse proxy to the Bun server with compression.
---

Compile the standalone binary once, copy it to the server, and run it from the folder holding `docs.yaml`:

```sh
mise run compile bun-linux-x64
./build/nodeps-linux-x64 serve --port 3000
```

Proxy to it from nginx, which handles TLS and compression:

```nginx title="/etc/nginx/sites-enabled/docs.conf"
server {
  listen 443 ssl;
  server_name docs.acme.dev;

  gzip on;
  gzip_types text/css text/javascript application/json text/markdown text/plain;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}
```
