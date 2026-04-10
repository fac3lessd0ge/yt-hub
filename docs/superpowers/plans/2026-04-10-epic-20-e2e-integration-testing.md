# Epic 20: E2E & Integration Testing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add middleware integration tests, fuzz/property-based tests on validators and parsers, enable integration tests in CI, and add docker-compose smoke test CI job to achieve validation confidence before re-screening.

**Architecture:** Middleware tests in Rust using the existing `make_app` pattern but with full middleware stack. Fuzz tests via property-based testing (Vitest for TS, proptest or manual generators for Rust). CI jobs for integration tests and docker-compose smoke tests.

**Tech Stack:** Rust (cargo test, axum tower::ServiceExt), TypeScript (Vitest), GitHub Actions, Docker Compose

**Scope decisions:**
- 20.1 (full chain E2E via docker) → deferred to 20.6 (localProd.sh in CI)
- 20.3 (rollback CI) → deferred (needs production deployment infra)
- Focus on what adds real confidence: middleware stack tests, fuzz tests, CI integration

---

## File Map

| File | Purpose |
|------|---------|
| `packages/yt-api/tests/middleware_test.rs` | NEW — middleware integration tests (security headers, CORS, rate limit) |
| `packages/yt-api/tests/common/mod.rs` | MODIFY — add `make_full_app` with security headers + CORS |
| `packages/yt-api/tests/validation_fuzz_test.rs` | NEW — property-based tests on URL/filename/destination validators |
| `packages/yt-downloader/tests/fuzz/sanitize.test.ts` | NEW — fuzz sanitizeFilename with random inputs |
| `packages/yt-downloader/tests/fuzz/progressParser.test.ts` | NEW — fuzz YtDlpProgressParser with random lines |
| `packages/yt-client/tests/lib/sseFuzz.test.ts` | NEW — fuzz SSE parser with malformed chunks |
| `.github/workflows/ci.yml` | MODIFY — add integration test job + docker-compose smoke job |

---

### Task 1: Middleware integration tests — security headers + CORS

**Files:**
- Modify: `packages/yt-api/tests/common/mod.rs`
- Create: `packages/yt-api/tests/middleware_test.rs`

- [ ] **Step 1: Add `make_full_app` to test common module**

Add to `packages/yt-api/tests/common/mod.rs` at the end:

```rust
pub fn make_full_app(mock: MockGrpcClient) -> Router {
    use axum::http::{HeaderValue, Method, header};
    use tower_http::cors::{AllowOrigin, CorsLayer};

    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(false)),
        metrics_handle: test_metrics_handle(),
        downloads_dir: std::env::temp_dir().join("yt-hub-test-downloads"),
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
        ]))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(false)
        .max_age(std::time::Duration::from_secs(3600));

    yt_api::routes::router::<MockGrpcClient>()
        .with_state(state)
        .layer(axum::middleware::from_fn(
            yt_api::middleware::request_id::request_id_middleware,
        ))
        .layer(axum::middleware::from_fn(
            yt_api::middleware::securityHeaders::security_headers_middleware,
        ))
        .layer(cors)
}
```

- [ ] **Step 2: Create middleware_test.rs**

Create `packages/yt-api/tests/middleware_test.rs`:

```rust
mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn security_headers_present_on_health() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);

    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.headers().get("x-frame-options").unwrap(), "DENY");
    assert_eq!(resp.headers().get("x-content-type-options").unwrap(), "nosniff");
    assert_eq!(resp.headers().get("x-xss-protection").unwrap(), "0");
    assert!(resp.headers().get("content-security-policy").is_some());
}

#[tokio::test]
async fn cors_allows_configured_origin() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);

    let req = Request::get("/health")
        .header("Origin", "http://localhost:5173")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(
        resp.headers().get("access-control-allow-origin").unwrap(),
        "http://localhost:5173"
    );
}

#[tokio::test]
async fn cors_blocks_unknown_origin() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);

    let req = Request::get("/health")
        .header("Origin", "https://evil.com")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert!(resp.headers().get("access-control-allow-origin").is_none());
}

#[tokio::test]
async fn request_id_header_present() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);

    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert!(resp.headers().get("x-request-id").is_some());
    let id = resp.headers().get("x-request-id").unwrap().to_str().unwrap();
    assert!(!id.is_empty());
}
```

- [ ] **Step 3: Run Rust tests**

Run: `cd packages/yt-api && cargo test`
Expected: All PASS (existing + 4 new)

- [ ] **Step 4: Commit**

```bash
git add packages/yt-api/tests/common/mod.rs packages/yt-api/tests/middleware_test.rs
git commit -m "test(yt-api): add middleware integration tests — headers, CORS, request ID"
```

---

### Task 2: Validation fuzz tests (Rust)

**Files:**
- Create: `packages/yt-api/tests/validation_fuzz_test.rs`

- [ ] **Step 1: Create fuzz tests for URL/filename/destination validators**

Create `packages/yt-api/tests/validation_fuzz_test.rs`:

```rust
use yt_api::validation;

#[test]
fn url_validation_never_panics_on_random_input() {
    let inputs = [
        "", " ", "\0", "\n\r", "null",
        "a".repeat(10000).as_str(),
        "https://", "http://", "ftp://youtube.com",
        "https://youtube.com", "https://youtube.com/",
        "https://youtube.com/watch", "https://youtube.com/watch?v=",
        "https://www.youtube.com/watch?v=abc&t=10",
        "https://youtu.be/", "https://youtu.be/abc",
        "https://m.youtube.com/watch?v=abc",
        "javascript:alert(1)", "data:text/html,<script>",
        "https://youtube.com.evil.com/watch?v=abc",
        "https://evil.com/youtube.com/watch?v=abc",
        "https://youtube.com/watch?v=abc/../../../etc/passwd",
        "https://youtube.com/shorts/", "https://youtube.com/shorts/abc",
        "\u{200B}https://youtube.com/watch?v=abc",
        "https://youtube.com/watch?v=abc\u{0000}extra",
    ];
    for input in &inputs {
        let _ = validation::validate_youtube_url(input);
    }
}

#[test]
fn filename_validation_never_panics() {
    let inputs = [
        "", " ", "\0", "a\0b", "../../../etc/passwd",
        "a".repeat(1000).as_str(),
        ".hidden", "..dotdot", "file/name", "file\\name",
        "file:name", "file*name", "file?name", "file\"name",
        "file<name>", "file|name", "normal.mp3",
        "\u{0001}\u{001F}", "\u{007F}", "\u{0080}\u{009F}",
        "名前.mp3", "файл.mp4", "🎵music.mp3",
    ];
    for input in &inputs {
        let _ = validation::validate_filename(input);
    }
}

#[test]
fn destination_validation_never_panics() {
    let inputs = [
        "", " ", "\0", "/valid/path", "relative/path",
        "a".repeat(2000).as_str(),
        "/path/../../../etc", "/path/with\0null",
        "/path\\backslash", "\\windows\\path",
        "/path/with spaces/ok", "/日本語/パス",
    ];
    for input in &inputs {
        let _ = validation::validate_destination(input);
    }
}

#[test]
fn url_validation_rejects_non_youtube_hosts() {
    let non_youtube = [
        "https://vimeo.com/123",
        "https://dailymotion.com/video/abc",
        "https://youtube.com.evil.com/watch?v=abc",
        "https://notyoutube.com/watch?v=abc",
        "https://youtu.be.evil.com/abc",
    ];
    for url in &non_youtube {
        assert!(validation::validate_youtube_url(url).is_err(), "should reject: {url}");
    }
}

#[test]
fn url_validation_accepts_valid_youtube_urls() {
    let valid = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?v=abc123",
        "http://youtube.com/watch?v=abc",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=abc",
        "https://www.youtube.com/shorts/abc123",
    ];
    for url in &valid {
        assert!(validation::validate_youtube_url(url).is_ok(), "should accept: {url}");
    }
}

#[test]
fn filename_validation_rejects_path_traversal() {
    let traversals = [
        "../etc/passwd", "..\\etc\\passwd", "foo/../bar",
        "..", "...", "/absolute", "\\windows",
    ];
    for input in &traversals {
        assert!(validation::validate_filename(input).is_err(), "should reject: {input}");
    }
}
```

- [ ] **Step 2: Run Rust tests**

Run: `cd packages/yt-api && cargo test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/yt-api/tests/validation_fuzz_test.rs
git commit -m "test(yt-api): add property-based fuzz tests for URL, filename, destination validators"
```

---

### Task 3: Fuzz tests — sanitizeFilename + progress parser (TypeScript)

**Files:**
- Create: `packages/yt-downloader/tests/fuzz/sanitize.test.ts`
- Create: `packages/yt-downloader/tests/fuzz/progressParser.test.ts`

- [ ] **Step 1: Create sanitizeFilename fuzz tests**

Create `packages/yt-downloader/tests/fuzz/sanitize.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "~/output";

function randomString(length: number): string {
  const chars = "\0\x01\x1f/\\:*?\"<>|abc123._ \t\n\r🎵日本語";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

describe("sanitizeFilename fuzz", () => {
  it("never returns empty string", () => {
    const inputs = [
      "", " ", "\0", "...", "///", "***", "<<<>>>", "\x01\x02\x03",
      ".hidden", "..dotdot", "   ",
    ];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("never contains path separators", () => {
    const inputs = ["a/b", "a\\b", "a/b\\c", ...Array.from({ length: 50 }, () => randomString(100))];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result).not.toContain("/");
      expect(result).not.toContain("\\");
    }
  });

  it("never exceeds 200 characters", () => {
    const inputs = [
      "a".repeat(500), randomString(1000), "日".repeat(300),
    ];
    for (const input of inputs) {
      expect(sanitizeFilename(input).length).toBeLessThanOrEqual(200);
    }
  });

  it("never starts with a dot", () => {
    const inputs = [".config", "..ssh", ".a", "..."];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result[0]).not.toBe(".");
    }
  });

  it("handles unicode safely", () => {
    const inputs = ["名前", "файл", "🎵music", "café", "naïve"];
    for (const input of inputs) {
      const result = sanitizeFilename(input);
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain("/");
    }
  });
});
```

- [ ] **Step 2: Create progress parser fuzz tests**

Create `packages/yt-downloader/tests/fuzz/progressParser.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { YtDlpProgressParser } from "~/download";

describe("YtDlpProgressParser fuzz", () => {
  const parser = new YtDlpProgressParser();

  it("never throws on random input", () => {
    const inputs = [
      "", " ", "\0", "\n", "random text",
      "[download]", "[download] ", "[download] 50%",
      "[download] abc% of 10MiB at 1MiB/s ETA 00:01",
      "[download] -1% of 10MiB at 1MiB/s ETA 00:01",
      "[download] 999% of 10MiB at 1MiB/s ETA 00:01",
      "[download] 50.0% of",
      "[download] 50.0% of 10MiB at",
      "[download] 50.0% of 10MiB at 1MiB/s ETA",
      "a".repeat(10000),
      "[download] NaN% of NaN at NaN ETA NaN",
    ];
    for (const input of inputs) {
      const result = parser.parseLine(input);
      expect(result === null || typeof result.percent === "number").toBe(true);
    }
  });

  it("returns valid percent range for matching lines", () => {
    const lines = [
      "[download]   0.0% of  10.00MiB at  1.00MiB/s ETA 00:10",
      "[download]  50.0% of  10.00MiB at  2.00MiB/s ETA 00:05",
      "[download]  99.9% of  10.00MiB at  5.00MiB/s ETA 00:01",
      "[download] 100% of   10.00MiB in 00:03",
    ];
    for (const line of lines) {
      const result = parser.parseLine(line);
      if (result) {
        expect(result.percent).toBeGreaterThanOrEqual(0);
        expect(result.percent).toBeLessThanOrEqual(100);
        expect(typeof result.speed).toBe("string");
        expect(typeof result.eta).toBe("string");
      }
    }
  });
});
```

- [ ] **Step 3: Run yt-downloader tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-downloader`
Expected: All PASS (existing + new fuzz tests)

- [ ] **Step 4: Commit**

```bash
git add packages/yt-downloader/tests/fuzz/
git commit -m "test(yt-downloader): add fuzz tests for sanitizeFilename and progress parser"
```

---

### Task 4: SSE parser fuzz tests (TypeScript)

**Files:**
- Create: `packages/yt-client/tests/lib/sseFuzz.test.ts`

- [ ] **Step 1: Create SSE parser fuzz tests**

Create `packages/yt-client/tests/lib/sseFuzz.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamDownload } from "@/lib/sse";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function createMockStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

const req = { link: "https://youtube.com/watch?v=abc", format: "mp3", name: "test" };

describe("SSE parser fuzz", () => {
  it("handles empty chunks without crashing", async () => {
    const stream = createMockStream([
      "",
      "\n",
      "\n\n",
      'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError: vi.fn() });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles missing event type gracefully", async () => {
    const stream = createMockStream([
      'data: {"percent":50}\n\n',
      'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress, onComplete, onError: vi.fn() });
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles missing data field gracefully", async () => {
    const stream = createMockStream([
      "event: progress\n\n",
      'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress, onComplete, onError: vi.fn() });
    expect(onProgress).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles binary-like data in event stream", async () => {
    const stream = createMockStream([
      "event: progress\ndata: \x00\x01\x02\n\n",
      'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onError = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("handles extremely long data lines", async () => {
    const longData = "a".repeat(100000);
    const stream = createMockStream([
      `event: progress\ndata: ${longData}\n\n`,
      'event: complete\ndata: {"output_path":"/t.mp3","title":"T","author_name":"A","format_id":"mp3","format_label":"MP3"}\n\n',
    ]);
    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const onError = vi.fn();
    const onComplete = vi.fn();
    await streamDownload(req, { onProgress: vi.fn(), onComplete, onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run yt-client tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx nx test yt-client`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/yt-client/tests/lib/sseFuzz.test.ts
git commit -m "test(yt-client): add SSE parser fuzz tests — edge cases, binary, oversized"
```

---

### Task 5: Enable integration tests + docker smoke in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add integration-test and docker-smoke jobs to CI**

Add two new jobs to `.github/workflows/ci.yml` after the existing `docker-build` job:

```yaml
  integration-test:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx nx build yt-downloader
      - name: Run integration tests
        run: npx nx test yt-downloader -- -- --reporter=verbose
        env:
          INTEGRATION: "1"
        timeout-minutes: 5

  docker-smoke:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build and start stack
        run: |
          echo "DOWNLOAD_DIR=./downloads" > .env
          mkdir -p downloads
          docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d --build
        timeout-minutes: 10
      - name: Wait for health
        run: |
          for i in $(seq 1 30); do
            if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
              echo "yt-api healthy after ${i}0 seconds"
              exit 0
            fi
            sleep 10
          done
          echo "yt-api did not become healthy"
          docker compose -f docker-compose.yml -f docker-compose.monitoring.yml logs yt-api --tail=30
          exit 1
        timeout-minutes: 5
      - name: Run smoke tests
        run: bash scripts/localProd.sh test
      - name: Teardown
        if: always()
        run: docker compose -f docker-compose.yml -f docker-compose.monitoring.yml down -v
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add integration test and docker-compose smoke test jobs"
```

---

### Task 6: Lint + typecheck + final verification

- [ ] **Step 1: Fix lint in all packages**

```bash
source ~/.nvm/nvm.sh && nvm use 20
cd packages/yt-downloader && npx biome check --write .
cd ../yt-client && npx biome check --write .
```

- [ ] **Step 2: Run full affected checks**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx nx affected -t lint,test,typecheck --base=dev
```

- [ ] **Step 3: Run Rust tests**

```bash
cd packages/yt-api && cargo test
```

- [ ] **Step 4: Commit lint fixes if any**

```bash
git add -A && git commit -m "chore: fix lint"
```
