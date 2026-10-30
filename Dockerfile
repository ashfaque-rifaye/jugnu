# The phone server: Jugnu's API on Cloud Run, for its fixed address. It carries the Exotel audio
# stream and shares the Turso database. The web app is not in this image. See docs/PHONE-SERVER.md.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV NODE_OPTIONS=--disable-warning=ExperimentalWarning
CMD ["npx", "tsx", "server/index.ts"]
