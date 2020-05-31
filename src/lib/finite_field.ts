/**
 * finite_field module implements operations on prime field
 */
import { secureRandom256 } from './crypto';

/**
 * secp256r1 elliptic curve order N.
 *   See: http://www.secg.org/sec2-v2.pdf
 */
export const N = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
/**
 * secp256k1 elliptic curve parameters P and N.
 *   See: http://www.secg.org/sec2-v2.pdf
 */
// export const P = BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f');
// export const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

export function add(x: bigint, y: bigint): bigint {
  return normalize(x + y);
}

export function mul(x: bigint, y: bigint): bigint {
  return normalize(x * y);
}

export function inv(x: bigint): bigint {
  x = x % N;
  if (x == 0n) throw new TypeError("'0' doesn't have inverse");
  if (x < 0) x += N;
  let r = egcd(N, x)[2];
  return normalize(N + r);
}

function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (a == 0n) return [b, 0n, 1n];
  let c = egcd(b % a, a);
  return [c[0], c[2] - (b / a) * c[1], c[1]];
}

// generates random number in finite field
export function rand(): bigint {
  return secureRandom256() % N;
}

function normalize(x: bigint) {
  x = x % N;
  return (x > 0) ? x : x + N;
}
