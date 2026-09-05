const MODEL = "Xenova/all-MiniLM-L6-v2";

let pipelinePromise = null;

async function loadPipeline() {
  const transformers = await import("@xenova/transformers");
  transformers.env.allowLocalModels = false;
  return transformers.pipeline("feature-extraction", MODEL, { quantized: true });
}

export function preload() {
  if (!pipelinePromise) pipelinePromise = loadPipeline();
  return pipelinePromise;
}

export function reset() {
  pipelinePromise = null;
}

function normalizeVector(values) {
  const vector = Float32Array.from(values);
  let norm = 0;
  for (let index = 0; index < vector.length; index += 1)
    norm += vector[index] * vector[index];
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  for (let index = 0; index < vector.length; index += 1) vector[index] /= norm;
  return vector;
}

export async function encode(text) {
  const extract = await preload();
  const output = await extract(String(text || ""), {
    pooling: "mean",
    normalize: true,
  });
  return normalizeVector(output.data);
}

export const neuralEncoder = {
  id: "neural",
  dims: 384,
  ready: false,
  encode,
  encodeAll: (list) => Promise.all(list.map(encode)),
  preload,
};
