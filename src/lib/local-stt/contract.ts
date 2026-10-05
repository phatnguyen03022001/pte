export const LOCAL_STT_MODEL_ID = "onnx-community/whisper-tiny.en";
export const LOCAL_STT_MODEL_REVISION =
  "2575352d61be1bf7225cf8f8b268a4678025fc58";

export type LocalSttBackend = "webgpu" | "wasm";

export type LocalSttWorkerRequest =
  | { type: "prepare" }
  | { type: "transcribe"; requestId: number; audio: Float32Array };

export type LocalSttWorkerResponse =
  | { type: "status"; message: string }
  | { type: "ready"; backend: LocalSttBackend }
  | {
      type: "result";
      requestId: number;
      backend: LocalSttBackend;
      transcript: string;
    }
  | { type: "error"; requestId?: number; message: string };
