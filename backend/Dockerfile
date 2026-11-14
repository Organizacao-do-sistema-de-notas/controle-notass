# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

# Optional trust configuration for HTTPS inspection proxies used by Codex.
RUN --mount=type=secret,id=proxy_ca,mode=0444 \
    if [ -f /run/secrets/proxy_ca ]; then \
      printf 'Acquire::https::CaInfo "/run/secrets/proxy_ca";\n' > /tmp/apt-proxy-ca.conf; \
    else touch /tmp/apt-proxy-ca.conf; fi; \
    apt-get -c /tmp/apt-proxy-ca.conf update \
    && apt-get -c /tmp/apt-proxy-ca.conf install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* /tmp/apt-proxy-ca.conf


WORKDIR /app/backend

COPY package.json package-lock.json ./
# Optional CA for development environments with an HTTPS inspection proxy.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci

COPY . .
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    ./node_modules/.bin/prisma generate --config prisma7.config.ts
RUN ./node_modules/.bin/tsc --noEmit

EXPOSE 3000
CMD ["npm", "run", "dev"]
