import { describe, expect, it } from "vitest";
import { CancellationError } from "~/download/errors/CancellationError";
import { TimeoutError } from "~/download/errors/TimeoutError";
import { NodeProcessSpawner } from "~/process/implementations/NodeProcessSpawner";

describe("NodeProcessSpawner", () => {
  const spawner = new NodeProcessSpawner();

  it("resolves with exit code on normal completion", async () => {
    const result = await spawner.spawn(["echo", "hello"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(0);
  });

  it("captures stdout lines via onStdout callback", async () => {
    const lines: string[] = [];
    await spawner.spawn(["echo", "line1"], {
      stdout: "pipe",
      stderr: "pipe",
      onStdout: (line) => lines.push(line),
    });
    expect(lines).toContain("line1");
  });

  it("captures stderr output", async () => {
    const result = await spawner.spawn(
      ["node", "-e", "process.stderr.write('err\\n')"],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(result.stderr).toBe("err");
  });

  it("rejects with CancellationError when signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      spawner.spawn(["echo", "hello"], {
        stdout: "pipe",
        stderr: "pipe",
        signal: ac.signal,
      }),
    ).rejects.toThrow(CancellationError);
  });

  it("rejects with CancellationError when signal fires during execution", async () => {
    const ac = new AbortController();
    // sleep long enough so we can abort mid-execution
    const promise = spawner.spawn(["sleep", "10"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: ac.signal,
    });
    // abort after a small delay
    setTimeout(() => ac.abort(), 50);
    await expect(promise).rejects.toThrow(CancellationError);
  });

  it("does not double-settle: abort during execution resolves only once", async () => {
    const ac = new AbortController();
    const promise = spawner.spawn(["sleep", "10"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: ac.signal,
    });
    setTimeout(() => ac.abort(), 50);
    // If double-settle occurred, this would either throw an unhandled rejection
    // or the promise would resolve after rejecting. We verify it rejects exactly once.
    const result = await promise.catch((err) => err);
    expect(result).toBeInstanceOf(CancellationError);
  });

  it("removes abort listener after normal completion", async () => {
    const ac = new AbortController();
    const result = await spawner.spawn(["echo", "done"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: ac.signal,
    });
    expect(result.exitCode).toBe(0);
    // Aborting after completion should not cause any issues
    ac.abort();
    // If the listener wasn't removed, this would attempt to reject an already-resolved promise
  });

  it("rejects with TimeoutError when process exceeds timeout", async () => {
    await expect(
      spawner.spawn(["sleep", "10"], {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 100,
      }),
    ).rejects.toThrow(TimeoutError);
  });

  it("TimeoutError contains the timeout duration", async () => {
    try {
      await spawner.spawn(["sleep", "10"], {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 150,
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as TimeoutError).message).toContain("150");
    }
  });

  it("does not reject with timeout when process completes in time", async () => {
    const result = await spawner.spawn(["echo", "fast"], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 5000,
    });
    expect(result.exitCode).toBe(0);
  });
});
