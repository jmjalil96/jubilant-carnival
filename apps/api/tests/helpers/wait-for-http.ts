type WaitForHttpOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export async function waitForHttp(
  url: string,
  { timeoutMs = 5_000, intervalMs = 100 }: WaitForHttpOptions = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, intervalMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        await response.arrayBuffer();
        return;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      await sleep(intervalMs);
    }
  }

  throw new Error(`Timed out waiting for HTTP server at ${url}`);
}
