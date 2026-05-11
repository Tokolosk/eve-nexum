FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare yarn@stable --activate
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable
COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
