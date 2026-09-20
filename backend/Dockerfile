# syntax=docker/dockerfile:1

# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Dependencies first, so a source-only change does not reinstall node_modules.
COPY package*.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree we are about to copy forward.
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# sharp needs libvips at runtime; the slim image does not ship it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips42 curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Never run as root: this container handles user-uploaded images.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/v1/health || exit 1

# The worker runs the same image with `command: node dist/worker`.
CMD ["node", "dist/main"]
