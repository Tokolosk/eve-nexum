FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

WORKDIR /app

COPY package.json yarn.lock ./

# Build needs devDependencies: typescript, vite, eslint tooling, etc.
RUN yarn install --frozen-lockfile --production=false

COPY . .

ARG VITE_GTM_ID=
ENV VITE_GTM_ID=$VITE_GTM_ID

RUN yarn build


FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template
ENV NGINX_ENVSUBST_FILTER='^API_PORT$'

EXPOSE 80