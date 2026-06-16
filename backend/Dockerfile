FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json frontend/
RUN npm ci --prefix frontend

COPY frontend frontend
RUN npm run build --prefix frontend -- --configuration production

FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app

COPY package*.json ./
COPY backend/package*.json backend/
RUN npm ci --prefix backend

COPY backend backend
RUN npm run build --prefix backend

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=frontend-builder /app/frontend/dist/frontend/browser /app/backend/public
RUN mkdir -p /app/backend/uploads

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/src/main.js"]
