FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare yarn@stable --activate
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable
COPY . .
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
