# ── Stage 1: build the React app ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: production image ────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
# Ensure app.config.json is not a directory (can happen on Windows builds)
RUN rm -rf /app/server/app.config.json
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001
CMD ["node", "server/server.js"]
