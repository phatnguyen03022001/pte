export function stopMediaTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function resampleMono(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16_000,
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = sourcePosition - left;
    output[index] =
      input[left] * (1 - fraction) + input[right] * fraction;
  }

  return output;
}

export async function decodeToMono16k(
  arrayBuffer: ArrayBuffer,
): Promise<Float32Array> {
  const context = new AudioContext();

  try {
    const decoded = await context.decodeAudioData(arrayBuffer);
    const mono = new Float32Array(decoded.length);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelData = decoded.getChannelData(channel);
      for (let index = 0; index < decoded.length; index += 1) {
        mono[index] += channelData[index] / decoded.numberOfChannels;
      }
    }

    return resampleMono(mono, decoded.sampleRate);
  } finally {
    await context.close();
  }
}
