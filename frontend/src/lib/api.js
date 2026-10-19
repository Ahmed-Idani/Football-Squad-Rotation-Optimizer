/*
 * Where the optimisation API lives.
 *
 * Set VITE_API_URL at build time to point the deployed frontend at the
 * deployed backend. Vite inlines it, so it must be present when `npm run
 * build` runs, not at runtime. Falls back to the local Flask dev server.
 */
const RAW = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

/* Trailing slashes would double up when joined with a path. */
export const API_BASE = RAW.replace(/\/+$/, "");

export const apiUrl = (path) =>
  `${API_BASE}/${String(path).replace(/^\/+/, "")}`;

/* ==========================================================================
   Cold starts.

   The API runs on Render's free tier, which spins the instance down after
   15 minutes without traffic. The next request then waits for a fresh boot,
   often 30 to 60 seconds, and while it boots Render may answer 502/503 or
   drop the connection outright. Without help the page just looks broken.

   apiFetch wraps fetch so that, until the API has answered once:
     - a request that has not answered after SLOW_MS flags the API as waking,
     - gateway errors and network failures are retried until WAKE_BUDGET_MS,
   and the status lives in a tiny store that <BackendStatus/> renders.
   ========================================================================== */

const SLOW_MS = 2500;
const WAKE_BUDGET_MS = 90_000;
const RETRY_MS = 3000;
/* Just under Render's idle timeout: past this, assume it may be asleep again. */
const IDLE_MS = 14 * 60_000;

const GATEWAY_ERRORS = new Set([502, 503, 504]);

/* status: "unknown" | "waking" | "ready" | "down" */
let state = { status: "unknown", since: Date.now() };
let lastOkAt = 0;
const listeners = new Set();

const setStatus = (status) => {
  if (state.status === status) return;
  state = { status, since: Date.now() };
  listeners.forEach((listener) => listener());
};

export const backendStatus = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
};

const isAwake = () => Date.now() - lastOkAt < IDLE_MS;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const apiFetch = async (path, init) => {
  const url = apiUrl(path);

  // Already warm: behave exactly like fetch, so a slow solve is not mistaken
  // for a cold start.
  if (isAwake()) {
    const response = await fetch(url, init);
    lastOkAt = Date.now();
    return response;
  }

  const started = Date.now();
  const slow = setTimeout(() => {
    if (!isAwake()) setStatus("waking");
  }, SLOW_MS);

  try {
    for (;;) {
      let response = null;
      let failure = null;
      try {
        response = await fetch(url, init);
      } catch (error) {
        failure = error;
      }

      if (response && !GATEWAY_ERRORS.has(response.status)) {
        lastOkAt = Date.now();
        setStatus("ready");
        return response;
      }

      // Another request may have woken it in the meantime; if so, this
      // failure is real and retrying would only hide it.
      const outOfTime = Date.now() - started + RETRY_MS > WAKE_BUDGET_MS;
      if (isAwake() || outOfTime) {
        if (!isAwake()) setStatus("down");
        if (failure) throw failure;
        return response;
      }

      setStatus("waking");
      await pause(RETRY_MS);
    }
  } finally {
    clearTimeout(slow);
  }
};

/* Fire-and-forget ping, so the boot starts before the visitor needs data. */
export const wakeBackend = () => {
  apiFetch("api/teams/").catch(() => {});
};
