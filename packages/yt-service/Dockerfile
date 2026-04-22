# ---- Stage 1: Build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/yt-downloader/package.json packages/yt-downloader/
COPY packages/yt-service/package.json packages/yt-service/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=yt-downloader --workspace=yt-service --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/yt-downloader/ packages/yt-downloader/
RUN npm run build --workspace=yt-downloader
COPY packages/yt-service/ packages/yt-service/
RUN npm run build --workspace=yt-service

# ---- Stage 2: Production deps only ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/yt-downloader/package.json packages/yt-downloader/
COPY packages/yt-service/package.json packages/yt-service/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=yt-downloader --workspace=yt-service --include-workspace-root --omit=dev

# ---- Stage 3: Runtime ----
FROM node:20-bookworm-slim AS runtime
ARG YT_DLP_VERSION=2026.03.17
# Update this hash when bumping YT_DLP_VERSION (from SHA2-256SUMS in the release)
ARG YT_DLP_SHA256=3bda0968a01cde70d26720653003b28553c71be14dcb2e5f4c24e9921fdad745
# Match host uid/gid so bind-mounted ./downloads stays writable from the container
ARG APP_UID=1001
ARG APP_GID=1001
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl python3 ca-certificates && \
    curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp && \
    echo "${YT_DLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum -c - && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*
RUN groupadd --gid ${APP_GID} appuser && \
    useradd --uid ${APP_UID} --gid ${APP_GID} --create-home appuser
WORKDIR /app

# Copy production-only node_modules from deps stage (no devDeps like tsx, vitest, etc.)
COPY --from=deps /app/node_modules/ node_modules/
COPY --from=deps /app/packages/yt-service/node_modules/ packages/yt-service/node_modules/
COPY --from=deps /app/packages/yt-downloader/node_modules/ packages/yt-downloader/node_modules/

# Copy built yt-downloader dist and package.json
COPY --from=build /app/packages/yt-downloader/dist/ packages/yt-downloader/dist/
COPY --from=build /app/packages/yt-downloader/package.json packages/yt-downloader/

# Copy compiled yt-service dist, proto files (needed at runtime by @grpc/proto-loader), and package.json
COPY --from=build /app/packages/yt-service/dist/ packages/yt-service/dist/
COPY packages/yt-service/proto/ packages/yt-service/proto/
COPY packages/yt-service/package.json packages/yt-service/

# Root package.json needed for workspace resolution
COPY package.json ./

# Create downloads directory
RUN mkdir -p /home/appuser/Downloads/yt-downloader && \
    chown -R appuser:appuser /home/appuser/Downloads && \
    chown -R appuser:appuser /app

USER appuser
VOLUME /home/appuser/Downloads/yt-downloader
ENV GRPC_HOST=0.0.0.0
ENV GRPC_PORT=50051
ENV INTERNAL_HTTP_HOST=0.0.0.0
ENV INTERNAL_HTTP_PORT=8081
EXPOSE 50051
EXPOSE 8081
# Prefer internal HTTP + shared secret (INTERNAL_API_KEY must be set at runtime).
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS -H "x-internal-api-key: ${INTERNAL_API_KEY}" http://127.0.0.1:8081/internal/health || exit 1
WORKDIR /app/packages/yt-service
CMD ["node", "dist/index.js"]
