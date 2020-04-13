import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

type MPCConfig = {
  n: number,
  k: number,
}

class Variable {
  name: string;
  secret: bigint;
  shares: { [x: string]: bigint };
  constructor(name: string) {
    this.name = name;
  }
  setShare(id: bigint|number, value: bigint) {
    this.shares[String(id)] = value;
  }
  getShare(id: bigint|number) {
    return this.shares[String(id)];
  }
  split(n: number, k: number) {
    for (let [pId, v] of sss.share(this.secret, n, k)) {
      this.setShare(pId, v);
    }
  }
  reconstruct() {
    const points: Point[] = [];
    for (let id in this.shares) {
      points.push([BigInt(id), this.shares[id]]);
    }
    this.secret = sss.reconstruct(points);
    return this.secret;
  }
}

class Party {
  id: number;
  peers: number[];
  constructor(id: number, peers: number[]) {
    this.id = id;
    this.peers = peers;
  }
  async connect() {
    // TODO: connect with peers
  }
  async disconnect() {
    // TODO: disconnect with peers
  }
  async sendResult(_r: Variable) {
    // TODO: send result to dealer
  }
  async sendShare(_v: Variable, _peerId: number) {
    // TODO: send a share to the peer.
  }
  async ensureShare(_v: Variable) {
    // TODO: ensure the share has already given by another party.
  }
}

// MPC arithmetic APIs
class MPC {
  p: Party;
  conf: MPCConfig;
  constructor(p: Party, n: number, k: number) {
    this.p = p;
    // TODO: validate n and k
    this.conf = { n: n, k: k };
  }
  async add(c: Variable, a: Variable, b: Variable) {
    // TODO: await in parallel
    await this.p.ensureShare(a);
    await this.p.ensureShare(b);
    let cValue = a.getShare(this.p.id) + b.getShare(this.p.id);
    return c.setShare(this.p.id, cValue);
  }
  async mul(c: Variable, a: Variable, b: Variable) {
    const abLocal = new Variable(`${a.name}${b.name}#${this.p.id}`);
    abLocal.secret = a.getShare(this.p.id) * b.getShare(this.p.id);
    abLocal.split(this.conf.n, this.conf.k);

    // broadcast shares of `ab` to peers
    // TODO: await in parallel
    for (let pId in abLocal.shares) {
      await this.p.sendShare(abLocal, Number(pId));
    }

    // collect `ab` from peers
    // TODO: await in parallel
    const ab = new Variable(`${a.name}${b.name}`);
    for (let i = 1; i <= this.conf.n; i++) {
      let abRemote = new Variable(`${a.name}${b.name}#${i}`);
      await this.p.ensureShare(abRemote);
      ab.setShare(i, abRemote.getShare(i))
    }

    return c.setShare(this.p.id, ab.reconstruct())
  }
}

function mpCompute(
  p: Party, n: number, k: number, func: (mpc: MPC) => Variable) {
  const mpc = new MPC(p, n, k);
  p.connect();
  const result = func(mpc);
  p.sendResult(result);
  p.disconnect();
}

export { MPCConfig, Variable, Party, MPC, mpCompute };
