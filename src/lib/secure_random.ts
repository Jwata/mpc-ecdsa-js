/**
 * Generates secure random values using [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Crypto).
 */
// generates random 256bits number
export function random256(): bigint {
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
