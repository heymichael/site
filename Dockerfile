# Build context: parent workspace directory (contains both site/ and haderach-home/)
# docker build -f site/Dockerfile -t site-api:latest .  (run from haderach_site/)

FROM node:20-alpine AS builder
WORKDIR /workspace

# Copy shared-ui package (local file dep: @haderach/shared-ui)
COPY haderach-home/packages/shared-ui ./haderach-home/packages/shared-ui

# Install site dependencies
WORKDIR /workspace/site
COPY site/package.json site/package-lock.json* ./
RUN npm ci

# Build the Vite app (outputs to dist/site/ per vite.config.ts base: '/site/')
COPY site/ .
RUN npm run build

# ---------------------------------------------------------------------------
# Production image: nginx serving the static build
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf
COPY site/nginx.conf /etc/nginx/conf.d/site.conf
COPY --from=builder /workspace/site/dist /app/dist

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
