# ---- Stage 1: Planner ----
FROM rust:1.88-bookworm AS planner
RUN cargo install cargo-chef --locked
WORKDIR /app
COPY packages/yt-api/ packages/yt-api/
COPY packages/yt-service/proto/ packages/yt-service/proto/
WORKDIR /app/packages/yt-api
RUN cargo chef prepare --recipe-path recipe.json

# ---- Stage 2: Cook (dependency cache) ----
FROM rust:1.88-bookworm AS cook
RUN cargo install cargo-chef --locked
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=planner /app/packages/yt-api/recipe.json packages/yt-api/recipe.json
COPY packages/yt-service/proto/ packages/yt-service/proto/
WORKDIR /app/packages/yt-api
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/packages/yt-api/target \
    cargo chef cook --release --recipe-path recipe.json

# ---- Stage 3: Build ----
FROM rust:1.88-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/yt-api/ packages/yt-api/
COPY packages/yt-service/proto/ packages/yt-service/proto/
WORKDIR /app/packages/yt-api
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/packages/yt-api/target \
    cargo build --release && \
    cp target/release/yt-api /app/yt-api

# ---- Stage 4: Runtime ----
FROM debian:bookworm-slim AS runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid 1001 --create-home appuser
COPY --from=build /app/yt-api /usr/local/bin/yt-api
RUN mkdir -p /home/appuser/Downloads/yt-downloader && \
    chown -R appuser:appuser /home/appuser/Downloads
USER appuser
ENV YT_API_HOST=0.0.0.0
ENV YT_API_PORT=3000
ENV GRPC_TARGET=http://yt-service:50051
ENV DOWNLOAD_DIR=/home/appuser/Downloads/yt-downloader
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1
CMD ["yt-api"]
