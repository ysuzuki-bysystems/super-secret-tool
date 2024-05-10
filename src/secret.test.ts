import { test, expect } from "bun:test";

import { encode, decode, importKey } from "./secret";

test("encode/decode", async () => {
  const key = await importKey("TEST");

  const tests = [
    0n,
    0n + 1n,
    0xFFFFn,
    0xFFFFn + 1n,
    0xFFFF_FFFFn,
    0xFFFF_FFFFn + 1n,
    0xFFFF_FFFF_FFFF_FFFFn, // 16byte = 1block
    0xFFFF_FFFF_FFFF_FFFFn + 1n, // 16byte = 1block
    0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn,
    0xFFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFF_FFFFn + 1n,
  ];

  for (const t of tests) {
    const r = await encode(key, t);
    const r2 = await decode(key, r);
    expect(r2).toBe(t);
  }
});
