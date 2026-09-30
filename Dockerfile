FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server ./server
COPY --from=build /app/dist/hat-raffle/browser ./dist/hat-raffle/browser
ENV PORT=3000 DATA_FILE=/data/scans.json
VOLUME /data
EXPOSE 3000
CMD ["node", "server/server.mjs"]
