# Single image for both the app and gateway services (docker-compose.yml
# overrides the command for gateway) - they share the same dependencies and
# there's no reason to maintain two Dockerfiles for two tiny Node scripts.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY public/ ./public/
COPY public-portal/ ./public-portal/
COPY public-demo/ ./public-demo/

EXPOSE 4000
CMD ["node", "server/server.js"]
