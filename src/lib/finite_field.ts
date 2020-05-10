/**
 * finite_field module implements operations on prime field
 */
import * as secureRandom from './secure_random';

/**
 * 256 bit prime number
 *   P = 2^256 - 2^32 - 2^9 − 2^8 − 2^7 − 2^6 − 2^4 − 2^0
 *     = ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f
 *   This number is known as a recommended parameter for secp256k1 Koblitz curve.
 *   http://www.secg.org/sec2-v2.pdf
 */
const P = 115792089237316195423570985008687907853269984665640564039457584007908834671663n
export { P };

export function add(x: bigint, y: bigint): bigint {
  return (P + x + y) % P;
}

export function mul(x: bigint, y: bigint): bigint {
  return (x * y) % P;
}

export function inv(x: bigint): bigint {
  x = x % P;
  if (x == 0n) throw new TypeError("'0' doesn't have inverse");
  if (x < 0) x += P;
  let r = egcd(P, x)[2];
  return (P + r) % P;
}

function egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (a == 0n) return [b, 0n, 1n];
  let c = egcd(b % a, a);
  return [c[0], c[2] - (b / a) * c[1], c[1]];
}

// generates random number in finite field
export function rand(): bigint {
  return secureRandom.random256() % P;
}
