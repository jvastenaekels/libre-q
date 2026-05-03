# Build stage
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# F-02-006 (frontend) — the upstream nginx:alpine image already drops to
# the unprivileged `nginx` user (UID 101) for worker processes; the
# master starts as root only to bind :80, which is the documented nginx
# pattern. No explicit USER directive needed; documenting the audit
# decision here so a future contributor doesn't add one and break
# port-binding.

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
