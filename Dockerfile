FROM node:24-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY backend/scripts/bi/config.mjs /app/backend/scripts/bi/config.mjs
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/frontend
COPY --from=build /app/frontend/node_modules ./node_modules
COPY --from=build /app/frontend/dist ./dist
COPY frontend/package.json ./
COPY frontend/server/*.mjs ./server/
COPY frontend/server/*.xlsx ./server/
COPY backend/scripts/bi/config.mjs /app/backend/scripts/bi/config.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/production.mjs"]
