import { useEffect, useState, useSyncExternalStore } from "react";
import { backendStatus, wakeBackend } from "../../lib/api.js";
import "./BackendStatus.css";

/* How long the "back up" confirmation stays after a cold start. */
const READY_FLASH_MS = 2500;

const clock = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/* Banner pinned to the top of every page while the API is booting. Silent
   when the API is already warm; see lib/api.js for how waking is detected. */
export const BackendStatus = () => {
  const { status, since } = useSyncExternalStore(
    backendStatus.subscribe,
    backendStatus.get,
  );
  const [now, setNow] = useState(() => Date.now());
  const [wokeUp, setWokeUp] = useState(false);

  useEffect(() => {
    if (status !== "waking") return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [status]);

  /* Only confirm "back up" if the visitor actually saw it waking. */
  useEffect(() => {
    if (status === "waking") setWokeUp(true);
    if (status !== "ready" || !wokeUp) return undefined;
    const hide = setTimeout(() => setWokeUp(false), READY_FLASH_MS);
    return () => clearTimeout(hide);
  }, [status, wokeUp]);

  if (status === "waking") {
    return (
      <div className="backend-status" role="status" aria-live="polite">
        <span className="backend-status__dot" aria-hidden="true" />
        <span>
          Waking the solver. It sleeps when idle, so this can take up to a
          minute.
        </span>
        <span className="backend-status__clock">{clock(now - since)}</span>
      </div>
    );
  }

  if (status === "down") {
    return (
      <div
        className="backend-status backend-status--down"
        role="alert"
      >
        <span>The solver isn’t answering.</span>
        <button
          type="button"
          className="backend-status__retry"
          onClick={wakeBackend}
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "ready" && wokeUp) {
    return (
      <div
        className="backend-status backend-status--ready"
        role="status"
        aria-live="polite"
      >
        Solver’s up.
      </div>
    );
  }

  return null;
};
