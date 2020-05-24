/**
 * Generates secure random 256bits number.
 * It internally calls Crypto.getRandomValues() in Web Crypto APIs.
 * See also https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
 */
export function secureRandom256(): bigint {
  function _sum(acc: bigint, x: number, i: number) {
    return acc += (BigInt(x) << BigInt(i * 32));
  }
  return getRandomValues(8).reduce(_sum, 0n);
}

export function getRandomValues(n: number): Uint32Array {
  let values = new Uint32Array(n);
  window.crypto.getRandomValues(values)
  return values;
};

/**
 * Calculates SHA256 hash from string message.
 * It internally calls SubtleCrypto.digest() in Web Crypto APIs.
 * See also https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 */
export async function sha256(m: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(m);
  return window.crypto.subtle.digest('SHA-256', data).then((hashBuf) => {
    const hashArray = Array.from(new Uint8Array(hashBuf));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}
