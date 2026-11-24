---
title: As static files
description: Export the site and serve the files from any web server.
order: 3
icon: files
byline: The nodeps maintainers
---

```sh
mise run build
```

Serve the output directory:

```nginx
location / {
  root /var/www/docs;
  try_files $uri $uri/ =404;
  error_page 404 /404.html;
}
```

> [!WARNING]
> A static export has no MCP endpoint. Everything else works the same.
