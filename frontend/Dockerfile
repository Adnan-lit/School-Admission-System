FROM node:24-slim AS build
WORKDIR /app

# Install first so package downloads are cached between code changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-write-runtime-config.sh /docker-entrypoint.d/40-write-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
