let patch: string;

export function getPatch() {
  if (typeof patch === `undefined`)
    patch = require(`zlib`).brotliDecompressSync(Buffer.from(`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`, `base64`)).toString();

  return patch;
}
