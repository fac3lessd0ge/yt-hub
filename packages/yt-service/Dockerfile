# ---- Stage 1: Build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/yt-downloader/package.json packages/yt-downloader/
COPY packages/yt-service/package.json packages/yt-service/
RUN npm ci --workspace=yt-downloader --workspace=yt-service --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/yt-downloader/ packages/yt-downloader/
RUN npm run build --workspace=yt-downloader

# ---- Stage 3: Runtime ----
FROM node:20-bookworm-slim AS runtime
ARG YT_DLP_VERSION=2026.03.17
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl python3 ca-certificates && \
    curl -L "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid 1001 --create-home appuser
WORKDIR /app

# Copy all node_modules from build stage (includes tsx and its dependencies)
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/packages/yt-service/node_modules/ packages/yt-service/node_modules/
COPY --from=build /app/packages/yt-downloader/node_modules/ packages/yt-downloader/node_modules/

# Copy built yt-downloader dist and package.json
COPY --from=build /app/packages/yt-downloader/dist/ packages/yt-downloader/dist/
COPY --from=build /app/packages/yt-downloader/package.json packages/yt-downloader/

# Copy yt-service source and configs
COPY packages/yt-service/src/ packages/yt-service/src/
COPY packages/yt-service/proto/ packages/yt-service/proto/
COPY packages/yt-service/package.json packages/yt-service/
COPY packages/yt-service/tsconfig.json packages/yt-service/

# Root package.json and tsconfig needed for workspace resolution and path aliases
COPY package.json ./
COPY tsconfig.base.json ./

# Create downloads directory
RUN mkdir -p /home/appuser/Downloads/yt-downloader && \
    chown -R appuser:appuser /home/appuser/Downloads && \
    chown -R appuser:appuser /app

USER appuser
VOLUME /home/appuser/Downloads/yt-downloader
ENV GRPC_HOST=0.0.0.0
ENV GRPC_PORT=50051
EXPOSE 50051
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "const net=require('net');const s=new net.Socket();s.connect(50051,'localhost',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));"
WORKDIR /app/packages/yt-service
CMD ["npx", "tsx", "src/index.ts"]
