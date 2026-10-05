import {
  LOCAL_STT_MODEL_ID,
  LOCAL_STT_MODEL_REVISION,
} from "@/lib/local-stt/contract";

const unpinnedPrefix =
  `https://huggingface.co/${LOCAL_STT_MODEL_ID}/resolve/main/`;
const pinnedPrefix =
  `https://huggingface.co/${LOCAL_STT_MODEL_ID}/resolve/${LOCAL_STT_MODEL_REVISION}/`;
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (!url.startsWith(unpinnedPrefix)) {
    return nativeFetch(input, init);
  }

  const pinnedUrl = pinnedPrefix + url.slice(unpinnedPrefix.length);
  return nativeFetch(pinnedUrl, init);
}) as typeof fetch;

await import("../../../lib/local-stt/stt.worker");
