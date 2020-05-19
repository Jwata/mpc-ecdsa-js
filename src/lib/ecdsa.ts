import * as BN from 'bn.js';
import * as elliptic from 'elliptic';

import * as GF from './finite_field';
import * as mpclib from './mpc';

export type ECPoint = elliptic.curve.base.BasePoint;

export class MPCEC {
  mpc: mpclib.MPC;
  curve: elliptic.ec;
  constructor(mpc: mpclib.MPC, curve: elliptic.ec) {
    this.mpc = mpc;
    this.curve = curve;
  }
}

// Reconstruct EC point from shares.
export function reconstruct(
  shares: Array<[bigint|number, ECPoint]>): ECPoint {
  // f(x=0)*G
  const x = 0n;

  // degree of polynomial
  const degree = shares.length - 1;
  let P = shares[0][1].curve.g.mul(new BN(0));

  for (let i = 0; i < degree + 1; i++) {
    const xi = BigInt(shares[i][0]);
    const Pi = shares[i][1];

    let n = 1n;
    let d = 1n;
    for (let j = 0; j < degree + 1; j++) {
      if (i == j) continue;
      let xj = BigInt(shares[j][0]);

      n = GF.mul(n, GF.add(x, -1n * xj));
      d = GF.mul(d, GF.add(xi, -1n * xj));
    }

    let l = GF.mul(n, GF.inv(d));
    P = P.add(Pi.mul(bigintToBN(l)))
  }

  return P;
}

function bigintToBN(n: bigint): BN {
  return new BN(n.toString(16), 'hex', 'be');
}
