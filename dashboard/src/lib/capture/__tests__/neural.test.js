jest.mock("@xenova/transformers", () => {
  const pipeline = jest.fn(async () => async (text) => ({
    data: new Float32Array(
      Array.from({ length: 384 }, (unused, index) =>
        Math.sin(index + String(text).length)
      )
    ),
  }));
  return { pipeline, env: {} };
}, { virtual: true });

import { cosine } from "../embed/cosine";

describe("the neural encoder", () => {
  let neural;

  beforeEach(async () => {
    jest.resetModules();
    neural = await import("../embed/neural");
    neural.reset();
  });

  test("returns unit length vectors of the declared width", async () => {
    const vector = await neural.encode("ap biology");
    expect(vector.length).toBe(384);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test("its vectors are comparable with the shared cosine", async () => {
    const a = await neural.encode("ap biology");
    const b = await neural.encode("ap biology");
    expect(cosine(a, b)).toBeCloseTo(1, 5);
  });

  test("the model is loaded once and reused", async () => {
    const transformers = await import("@xenova/transformers");
    await neural.encode("one");
    await neural.encode("two");
    expect(transformers.pipeline).toHaveBeenCalledTimes(1);
  });

  test("it exposes the same interface the lexical encoder does", async () => {
    const { lexicalEncoder } = await import("../embed");
    expect(Object.keys(neural.neuralEncoder)).toEqual(
      expect.arrayContaining(Object.keys(lexicalEncoder).filter((k) => k !== "ready"))
    );
    expect(typeof neural.neuralEncoder.encode).toBe("function");
    expect(typeof neural.neuralEncoder.encodeAll).toBe("function");
  });

  test("encodeAll resolves every input", async () => {
    const vectors = await neural.neuralEncoder.encodeAll(["a", "bb"]);
    expect(vectors).toHaveLength(2);
    vectors.forEach((vector) => expect(vector.length).toBe(384));
  });

  test("empty text still yields a usable vector", async () => {
    const vector = await neural.encode("");
    expect(vector.length).toBe(384);
    expect(vector.every((value) => Number.isFinite(value))).toBe(true);
  });
});

test("the default encoder is the lexical one until the neural one is loaded", async () => {
  const { getEncoder, lexicalEncoder } = await import("../embed");
  expect(getEncoder()).toBe(lexicalEncoder);
  expect(getEncoder("neural")).toBe(lexicalEncoder);
});
