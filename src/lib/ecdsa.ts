import * as BN from 'bn.js';
import * as elliptic from 'elliptic';

import * as GF from './finite_field';
import { Party, MPC, MPCConfig, Secret, Share } from './mpc';

export const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

export type ECPoint = elliptic.curve.base.BasePoint;

// Reconstruct EC point from shares.
export function reconstruct(
  shares: Array<[bigint | number, ECPoint]>): ECPoint {
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
    P = P.add(Pi.mul(bigintToBN(l)));
  }

  return P;
}

export function bigintToBN(n: bigint): BN {
  return new BN(n.toString(16), 'hex', 'be');
}

export function bnToBigint(bn: BN): bigint {
  return BigInt(`0x${bn.toJSON()}`);
}

export class MPCECDsa extends MPC {
  curve: elliptic.ec;
  privateKey: Share;
  publicKey: ECPoint;
  constructor(p: Party, conf: MPCConfig, curve: elliptic.ec) {
    super(p, conf);
    this.curve = curve;
  };
  async randPoint(r: Share) {
    // derive R from r.
    const rHex = r.value.toString(16);
    const keyPair = this.curve.keyFromPrivate(rHex, 'hex');

    const Ri = keyPair.getPublic();
    const RX = new Secret(`${r.name}#Point.X`);
    const RX_i = RX.getShare(this.p.id);
    RX_i.value = bnToBigint(Ri.getX());
    const RY = new Secret(`${r.name}#Point.Y`);
    const RY_i = RY.getShare(this.p.id);
    RY_i.value = bnToBigint(Ri.getY());

    // send R shares to peers
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) continue;
      await this.sendShare(RX_i, j);
      await this.sendShare(RY_i, j);
    }

    // reconstruct R from shares
    const points: Array<[number, ECPoint]> = [];
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) {
        points.push([j, Ri])
        continue;
      }
      const RX_j = RX.getShare(j);
      const RY_j = RY.getShare(j);
      await this.recieveShare(RX_j);
      await this.recieveShare(RY_j);
      const pub_j = this.curve.keyFromPublic({
        x: RX_j.value.toString(16),
        y: RY_j.value.toString(16),
      }).getPublic();
      points.push([j, pub_j]);
    }

    return reconstruct(points);
  }
  async keyGen() {
    this.privateKey = new Share('privateKey', this.p.id);
    await this.rand(this.privateKey);
    this.publicKey = await this.randPoint(this.privateKey);
  }
}
