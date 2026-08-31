# Stage 1 - frontend build.
# Needs the dev dependencies (Vite, React, Tailwind, shadcn) that the runtime
# image deliberately does not carry, so it installs the full dependency tree
# and produces the two build outputs the server serves statically:
#   npm run build          -> public/dist (Vite bundle)
#   npm run registry:build -> public/r    (shadcn registry JSON)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run registry:build

# Stage 2 - runtime.
# Single image for both the app and gateway services (docker-compose.yml
# overrides the command for gateway) - they share the same dependencies and
# there's no reason to maintain two Dockerfiles for two tiny Node scripts.
# Installs production dependencies only, so the image keeps just `pg`; the
# frontend toolchain stays behind in the builder stage.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY public/ ./public/
COPY public-portal/ ./public-portal/
COPY public-demo/ ./public-demo/
COPY public-storefront/ ./public-storefront/

# Built frontend assets from the builder stage. Copied after public/ so they
# are never clobbered by a stale local build that slipped into the context.
COPY --from=builder /app/public/dist/ ./public/dist/
COPY --from=builder /app/public/r/ ./public/r/

EXPOSE 4000
CMD ["node", "server/server.js"]
