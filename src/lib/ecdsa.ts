import * as BN from 'bn.js';
import * as elliptic from 'elliptic';
const Signature = require('elliptic/lib/elliptic/ec/signature');

import { sha256 } from './crypto';
import * as GF from './finite_field';
import { Party, MPC, MPCConfig, Secret, Share, Public } from './mpc';

export const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');

export type ECPoint = elliptic.curve.base.BasePoint;

class MPCECDSAError extends Error {
  constructor(m?: string) {
    super(m);
    Object.setPrototypeOf(this, MPCECDSAError.prototype);
  }
}

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
  constructor(p: Party, conf: MPCConfig, curve: elliptic.ec) {
    super(p, conf);
    this.curve = curve;
  };
  async keyGen(pk: Share): Promise<ECPoint> {
    await this.rand(pk);
    return this._derivePoint(pk);
  }
  async sign(
    m: string, pk: Share, pubkey: ECPoint): Promise<elliptic.ec.Signature> {
    // calculate h(m)
    const hHex = await sha256(m);
    const h = BigInt(`0x${hHex}`);

    // generate nonce k and invert it.
    const ki = new Share(`sign#${hHex}#k`, this.p.id);
    await this.rand(ki);
    const ki_inv = new Share(`sign#${hHex}#k^-1`, this.p.id);
    await this.inv(ki_inv, ki);

    const R = await this._derivePoint(ki);
    const r = new Public(`sign#${hHex}#r`, bnToBigint(R.getX()));

    // beta = H(m) + r * x
    const bi = new Share(`sign#${hHex}#beta`, this.p.id,
      GF.add(h, GF.mul(r.value, pk.value)));

    // s = k^-1 * beta
    const si = new Share(`sign#${hHex}#s`, this.p.id);
    await this.mul(si, ki_inv, bi);

    // Send `s` to peers and reconstruct it.
    const s = new Secret(`sign#${hHex}#s`);
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) continue;
      await this.sendShare(si, j);
    }
    for (let j = 1; j <= this.conf.n; j++) {
      if (this.p.id == j) {
        s.setShare(j, si.value);
        continue;
      }
      await this.recieveShare(s.getShare(j));
    }
    s.reconstruct()

    // verify the signature.
    const keyPair = this.curve.keyFromPublic(
      pubkey.encodeCompressed('hex'), 'hex');
    const sig: elliptic.ec.Signature = new Signature({
      r: r.value.toString(16),
      s: s.value.toString(16),
    });
    if (!keyPair.verify(hHex, sig)) {
      throw new MPCECDSAError('Failed to construct a valid signature');
    }
    return sig;
  }
  async _derivePoint(r: Share) {
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
}
