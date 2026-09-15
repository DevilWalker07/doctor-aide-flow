import "./mocks.js";
import { createApp } from "../../../server/app.js";
import { createMemoryJobStore, type JobStore } from "../../../server/services/jobStore.js";

export function makeApp(store?: JobStore) {
  const jobStore = store ?? createMemoryJobStore({ ttlMs: 60_000, sweepMs: 60_000 });
  return { app: createApp({ jobStore }), jobStore };
}

export async function waitFor<T>(fn: () => Promise<T | null | undefined>, pred: (v: T) => boolean, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v && pred(v)) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("waitFor: tempo esgotado");
}
