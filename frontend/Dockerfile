FROM node:24-slim AS source
WORKDIR /app

# Install first so package downloads are cached between code changes.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Only built when running the tests: docker compose run --rm --build frontend-tests
FROM source AS test
CMD ["npm", "test"]

FROM source AS build
RUN npm run build

FROM nginx:stable-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --chmod=755 docker/40-write-runtime-config.sh /docker-entrypoint.d/40-write-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
