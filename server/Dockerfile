FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /app

COPY package.json yarn.lock ./

# Build needs devDependencies, especially typescript.
# This must ignore NODE_ENV=production from Coolify.
RUN yarn install --frozen-lockfile --production=false

COPY . .

RUN yarn build


FROM node:20-alpine AS prod-deps

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /app

COPY package.json yarn.lock ./

# Runtime only needs production dependencies.
RUN yarn install --frozen-lockfile --production=true && yarn cache clean


FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/src/index.js"]