import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

class Variable {
  name: string;
  secret: bigint;
  shares: { [x: string]: bigint };
  constructor(name: string) {
    this.name = name;
    this.shares = {};
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

const _KEY_PARTIES = 'parties';

class Party {
  id: number;
  peers: number[];
  session: Session;
  constructor(id: number, peers: number[]) {
    this.id = id;
    this.peers = peers;
  }
  async connect() {
    // TODO: connect with peers
    let parties = await this.session.register(this.id);

    function isReady(parties: Set<number>): boolean {
      if (!parties.has(this.id)) return false;
      for (let pId of this.peers) {
        if (!parties.has(pId)) return false;
      }
      return true;
    }
    while (!isReady(parties)) {
      parties = await this.session.onPartiesChange();
    }
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

class Session {
  async onChange(key:string): Promise<string> {
    const p: Promise<string> = new Promise((resolve, _reject) => {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.storageArea != localStorage) return;
        if (event.key != key) return;
        resolve(event.newValue);
      });
    })
    return p;
  }

  async register(id: number): Promise<Set<number>> {
    const parties = await this.getParties();
    parties.add(id);
    await this.setParties(parties);
    return parties;
  }
  async getParties(): Promise<Set<number>> {
    const parties = JSON.parse(window.localStorage.getItem(_KEY_PARTIES));
    return new Set(parties);
  }
  async setParties(parties: Set<number>) {
    window.localStorage.setItem(
      _KEY_PARTIES, JSON.stringify(Array.from(parties)));
  }

  async onPartiesChange(): Promise<Set<number>> {
    return this.onChange(_KEY_PARTIES).then((parties) => {
      return new Set(JSON.parse(parties));
    });
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

type MPCConfig = {
  n: number,
  k: number,
}

export { Variable, Party, MPC, mpCompute };
