FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

WORKDIR /app
COPY server.js ./
COPY public ./public

# Läuft bewusst ohne USER-Wechsel: so klappt das Schreiben in ./daten auch,
# wenn Docker den Ordner beim ersten Start selbst anlegt (gehört dann root).
RUN mkdir -p /data

VOLUME /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/status >/dev/null || exit 1

CMD ["node", "server.js"]
