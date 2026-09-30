# Backend only: API, shared config and live events. Build from the server/ directory:
#   docker build -t hat-raffle-backend server
FROM node:22-alpine
WORKDIR /app

# The backend has no npm dependencies – the sources are all it needs.
COPY *.mjs ./
RUN rm -f *.test.mjs && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_FILE=/data/scans.json \
    CONFIG_FILE=/data/config.json \
    STATIC_DIR=/app/public

USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "server.mjs"]
