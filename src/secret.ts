export async function importKey(key: string): Promise<CryptoKey> {
  const buf = new TextEncoder().encode(key);

  let buf2: Uint8Array;
  if (buf.length <= 128 / 8) {
    buf2 = new Uint8Array(128 / 8);
  } else if (buf.length <= 192 / 8) {
    buf2 = new Uint8Array(192 / 8);
  } else if (buf.length <= 256 / 8) {
    buf2 = new Uint8Array(256 / 8);
  } else {
    buf2 = new Uint8Array(256 / 8);
  }
  buf2.set(buf.slice(0, Math.min(buf.length, buf2.byteLength)), 0);

  return await crypto.subtle.importKey(
    "raw",
    buf2,
    { name: "AES-CBC", length: buf2.length * 8 },
    true,
    ["encrypt", "decrypt"],
  );
}

function* blocks(buf: Uint8Array, size: number): Generator<[Uint8Array, boolean]> {
  while (buf.length > 0) {
    yield [buf.subarray(0, size), buf.length <= size];
    buf = buf.subarray(size);
  }
}

async function btoa(val: number[]): Promise<string> {
  if (typeof globalThis["Buffer"] === "function") {
    // Node.js bun deno ...
    return Buffer.from(val).toString("base64");
  }

  const blob = new Blob([new Uint8Array(val)], { });
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", (event) => resolve(event.target?.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(blob);
  });
  if (typeof url !== "string") {
    throw new Error();
  }
  const [_, base64] = url.split(",");
  return base64;
}

async function atob(val: string): Promise<Uint8Array> {
  if (typeof globalThis["Buffer"] === "function") {
    // Node.js bun deno ...
    return Buffer.from(val, "base64");
  }

  const url = `data:application/octet-stream;base64,${val}`;
  const result = await fetch(url);
  return new Uint8Array(await result.arrayBuffer());
}

export async function encode(key: CryptoKey, val: bigint): Promise<string> {
  const blockSize = 16;

  const plain = new TextEncoder().encode(val.toString(16));
  const cipherText: number[] = [];
  for (const [block] of blocks(plain, blockSize)) {
    // ブロック単位に iv を初期化しながら符号化
    const result = await crypto.subtle.encrypt({
      name: "AES-CBC",
      iv: new Uint8Array(blockSize),
    }, key, block);

    // パディングのみのブロックは除外する
    cipherText.push(...new Uint8Array(result, 0, blockSize));
  }

  // パディングのみのブロックが必要な場合、追加
  if (plain.length % blockSize === 0) {
    const result = await crypto.subtle.encrypt({
      name: "AES-CBC",
      iv: new Uint8Array(blockSize),
    }, key, new Uint8Array(blockSize).fill(blockSize));
    cipherText.push(...new Uint8Array(result, 0, blockSize));
  }

  return await btoa(cipherText);
}

/** 復号化の際に疑似的なパディングのみのブロックを追加する */
async function appendPadding(key: CryptoKey, block: Uint8Array): Promise<Uint8Array> {
  if (block.length !== 16) {
    throw new Error();
  }

  const pad = await crypto.subtle.encrypt({
    name: "AES-CBC",
    iv: block, // パディング対象のブロックを iv とする
  }, key, new Uint8Array(block.length).fill(block.length));

  const ret = new Uint8Array(block.length * 2);
  ret.set(block, 0 * block.length);
  ret.set(new Uint8Array(pad, 0, block.length), 1 * block.length);
  return ret;
}

/** 最終ブロックのパディングを除去 */
function trimPadding(block: ArrayBuffer, last: boolean): Uint8Array {
  const  buf = new Uint8Array(block);
  if (!last) {
    return buf;
  }

  const n = buf.at(-1);
  if (typeof n !== "number") {
    throw new Error();
  }
  if (n > buf.length) {
    throw new Error();
  }

  return buf.subarray(0, buf.length - n);
}

export async function decode(key: CryptoKey, secret: string): Promise<bigint> {
  if (secret.length === 0) {
    throw new Error("empty");
  }

  const blockSize = 16;

  const ciperText = await atob(secret);
  const plain: number[] = [];
  for (const [block, last] of blocks(ciperText, blockSize)) {
    const blockWithPadding = await appendPadding(key, block);
    const result = await crypto.subtle.decrypt({
      name: "AES-CBC",
      iv: new Uint8Array(blockSize),
    }, key, blockWithPadding);
    plain.push(...trimPadding(result.slice(0, 16), last));
  }

  return BigInt(`0x${new TextDecoder().decode(Uint8Array.from(plain))}`);
}
