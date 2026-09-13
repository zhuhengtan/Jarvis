/** Background workers are intentionally bounded: no model output may bypass memory review. */
const intervalMs = Number(process.env.JARVIS_WORKER_INTERVAL_MS ?? 60_000);
console.log(`Jarvis consolidation worker scheduled every ${intervalMs}ms`);
setInterval(() => console.log("Jarvis worker tick: candidate promotion requires explicit review."), intervalMs).unref();
