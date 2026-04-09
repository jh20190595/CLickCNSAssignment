FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build && npm prune --production

# ---- Production image ----
FROM node:20-slim

WORKDIR /app

# Python + vosk pip (STT 엔진)
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    && pip3 install vosk --break-system-packages \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY src/stt/stt_worker.py ./stt_worker.py

VOLUME ["/app/model"]

EXPOSE 3001

CMD ["node", "dist/main"]
