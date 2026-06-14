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

# Runtime shared libraries for the canvas/sharp native addons. The builder
# stage compiles against the -dev packages; the production image needs the
# matching runtime libs (and their transitive deps) or node aborts with a
# fatal signal at addon load, before any JS runs. libc6-compat provides the
# glibc shim some prebuilt binaries expect on musl/alpine.
RUN apk add --no-cache \
    openssl \
    cairo pango libjpeg-turbo giflib librsvg \
    pixman fontconfig freetype fribidi harfbuzz \
    libc6-compat

WORKDIR /app
RUN mkdir -p /app/logs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/boot.js"]
