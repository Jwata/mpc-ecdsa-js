import * as BN from 'bn.js';
import * as elliptic from 'elliptic';

import * as GF from './finite_field';
import { Party, MPC, MPCConfig, Secret, Share, Variable } from './mpc';

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

export class MPCECDsa extends MPC {
  curve: elliptic.ec;
  privateKey: Share;
  keyPair: elliptic.ec.KeyPair;
  publicKey: ECPoint;
  constructor(p: Party, conf: MPCConfig, curve: elliptic.ec) {
    super(p, conf);
    this.curve = curve;
  };
  async keyGen() {
    const priv = new Share('privateKey', this.p.id);
    await this.rand(priv);
    this.privateKey = priv;

    // derive pubkey from privateKey.
    const privHex = priv.value.toString(16);
    const keyPair = this.curve.keyFromPrivate(privHex, 'hex');
    this.keyPair = keyPair;

    const pub_i = keyPair.getPublic();
    const xHex = `0x${pub_i.getX().toJSON()}`;
    const pubX = new Secret('pubX');
    const pubX_i = pubX.getShare(this.p.id);
    pubX_i.value = BigInt(xHex);
    const yHex = `0x${pub_i.getY().toJSON()}`;
    const pubY = new Secret('pubY');
    const pubY_i = pubY.getShare(this.p.id);
    pubY_i.value = BigInt(yHex);

    // send pubkey shares to peers
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) continue;
      await this.sendShare(pubX_i, j);
      await this.sendShare(pubY_i, j);
    }

    // reconstruct pubkey from shares
    const points: Array<[number, ECPoint]> = [];
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) {
        points.push([j, pub_i])
        continue;
      }
      const pubX_j = pubX.getShare(j);
      const pubY_j = pubY.getShare(j);
      await this.recieveShare(pubX_j);
      await this.recieveShare(pubY_j);
      const pub_j = this.curve.keyFromPublic({
        x: pubX_j.value.toString(16),
        y: pubY_j.value.toString(16),
      }).getPublic();
      points.push([j, pub_j]);
    }

    this.publicKey = reconstruct(points);
  }
}
