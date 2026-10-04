import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/whisper-tiny.en";
const MODEL_REVISION = "2575352d61be1bf7225cf8f8b268a4678025fc58";

type Backend = "webgpu" | "wasm";
type Transcriber = (
  audio: Float32Array,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

type WorkerRequest =
  | { type: "prepare" }
  | { type: "transcribe"; requestId: number; audio: Float32Array };

type WorkerResponse =
  | { type: "status"; message: string }
  | { type: "ready"; backend: Backend }
  | { type: "result"; requestId: number; backend: Backend; transcript: string }
  | { type: "error"; requestId?: number; message: string };

let transcriber: Transcriber | null = null;
let backend: Backend | null = null;
let preparing: Promise<Backend> | null = null;

function send(message: WorkerResponse) {
  self.postMessage(message);
}

async function loadBackend(nextBackend: Backend): Promise<Backend> {
  if (nextBackend === "webgpu" && !("gpu" in navigator)) {
    throw new Error("WebGPU is unavailable.");
  }

  send({
    type: "status",
    message:
      nextBackend === "webgpu"
        ? "Preparing local STT with WebGPU..."
        : "Preparing local STT with WASM...",
  });

  const loaded = await pipeline(
    "automatic-speech-recognition",
    MODEL_ID,
    {
      device: nextBackend,
      revision: MODEL_REVISION,
    },
  );

  transcriber = loaded as unknown as Transcriber;
  backend = nextBackend;
  send({ type: "ready", backend: nextBackend });
  return nextBackend;
}

async function prepare(): Promise<Backend> {
  if (transcriber && backend) {
    send({ type: "ready", backend });
    return backend;
  }

  if (preparing) {
    return preparing;
  }

  preparing = (async () => {
    try {
      return await loadBackend("webgpu");
    } catch {
      transcriber = null;
      backend = null;
      return loadBackend("wasm");
    } finally {
      preparing = null;
    }
  })();

  return preparing;
}

function transcriptFromOutput(
  output: { text?: string } | Array<{ text?: string }>,
): string {
  const value = Array.isArray(output) ? output[0]?.text : output.text;
  return typeof value === "string" ? value.trim() : "";
}

async function transcribe(requestId: number, audio: Float32Array) {
  try {
    await prepare();

    if (!transcriber || !backend) {
      throw new Error("Local STT is unavailable.");
    }

    try {
      const output = await transcriber(audio);
      send({
        type: "result",
        requestId,
        backend,
        transcript: transcriptFromOutput(output),
      });
      return;
    } catch (error) {
      if (backend !== "webgpu") {
        throw error;
      }

      transcriber = null;
      backend = null;
      await loadBackend("wasm");

      if (!transcriber || backend !== "wasm") {
        throw new Error("WASM fallback did not initialize.");
      }

      const output = await transcriber(audio);
      send({
        type: "result",
        requestId,
        backend,
        transcript: transcriptFromOutput(output),
      });
    }
  } catch {
    send({
      type: "error",
      requestId,
      message:
        "Local transcription failed. Reset this item and try again; your audio was not uploaded.",
    });
  } finally {
    audio.fill(0);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === "prepare") {
    void prepare().catch(() => {
      send({
        type: "error",
        message:
          "Local STT preparation failed. Check model download/browser support and try again.",
      });
    });
    return;
  }

  void transcribe(message.requestId, message.audio);
};
