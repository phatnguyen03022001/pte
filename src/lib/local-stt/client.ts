export function createLocalSttWorker(): Worker {
  return new Worker(new URL("./stt.worker.ts", import.meta.url), {
    type: "module",
  });
}
