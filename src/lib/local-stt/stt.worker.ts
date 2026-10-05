import { pipeline } from "@huggingface/transformers";

import {
  LOCAL_STT_MODEL_ID,
  LOCAL_STT_MODEL_REVISION,
  type LocalSttBackend,
  type LocalSttWorkerRequest,
  type LocalSttWorkerResponse,
} from "./contract";

type Transcriber = (
  audio: Float32Array,
) => Promise<{ text?: string } | Array<{ text?: string }>>;

let transcriber: Transcriber | null = null;
let backend: LocalSttBackend | null = null;
let preparing: Promise<LocalSttBackend> | null = null;

function send(message: LocalSttWorkerResponse) {
  self.postMessage(message);
}

async function loadBackend(
  nextBackend: LocalSttBackend,
): Promise<{ backend: LocalSttBackend; transcriber: Transcriber }> {
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
    LOCAL_STT_MODEL_ID,
    {
      device: nextBackend,
      revision: LOCAL_STT_MODEL_REVISION,
    },
  );

  const loadedTranscriber = loaded as unknown as Transcriber;
  transcriber = loadedTranscriber;
  backend = nextBackend;
  send({ type: "ready", backend: nextBackend });
  return { backend: nextBackend, transcriber: loadedTranscriber };
}

async function prepare(): Promise<LocalSttBackend> {
  if (transcriber && backend) {
    send({ type: "ready", backend });
    return backend;
  }

  if (preparing) {
    return preparing;
  }

  preparing = (async () => {
    try {
      return (await loadBackend("webgpu")).backend;
    } catch {
      transcriber = null;
      backend = null;
      return (await loadBackend("wasm")).backend;
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
      const fallback = await loadBackend("wasm");
      const output = await fallback.transcriber(audio);
      send({
        type: "result",
        requestId,
        backend: fallback.backend,
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

self.onmessage = (event: MessageEvent<LocalSttWorkerRequest>) => {
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
