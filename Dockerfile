FROM node:20-alpine AS builder

RUN apk add --no-cache openssl openssl-dev python3 make g++ cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production

RUN apk add --no-cache openssl cairo pango libjpeg-turbo giflib librsvg

WORKDIR /app
RUN mkdir -p /app/logs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
