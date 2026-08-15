/**
 * Zstandard decompression for session logs. The JSONL backend writes zstd
 * frames (often one small frame per packed chunk), so a whole file is a
 * concatenated multi-frame stream. fzstd's one-shot decompress loops over
 * frames until the input is consumed, which is exactly what we need.
 */
import { decompress } from './vendor/fzstd.mjs'

/** Decompress a (possibly multi-frame) Zstandard buffer to UTF-8 text. */
export function decompressZstdToText(input: Uint8Array): string {
  const out = decompress(input)
  return new TextDecoder().decode(out)
}
