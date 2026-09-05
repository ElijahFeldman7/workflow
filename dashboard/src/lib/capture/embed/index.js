import { lexicalEncoder } from "./lexical";
import { cosine } from "./cosine";

export { cosine };
export { lexicalEncoder };

let neuralModule = null;

export function getEncoder(kind) {
  return kind === "neural" && neuralModule
    ? neuralModule.neuralEncoder
    : lexicalEncoder;
}

export async function loadNeuralEncoder() {
  if (!neuralModule) neuralModule = await import("./neural");
  await neuralModule.preload();
  return neuralModule.neuralEncoder;
}

export function resetEncoders() {
  neuralModule = null;
}
