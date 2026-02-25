FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

COPY backend/package*.json backend/tsconfig.json ./
WORKDIR /app
RUN npm ci

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodejs

EXPOSE 8080

CMD ["node", "dist/index.js"]
