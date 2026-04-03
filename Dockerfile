# ── build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
# Install only frontend deps (express/cors not needed at build time)
RUN npm install

COPY . .
RUN npm run build

# ── api-deps stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS api-deps
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# ── production runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000

# Copy built static files
COPY --from=builder /app/dist ./dist

# Copy server and its deps
COPY server ./server
COPY --from=api-deps /app/server/node_modules ./server/node_modules

EXPOSE 3000
CMD ["node", "server/index.cjs"]
