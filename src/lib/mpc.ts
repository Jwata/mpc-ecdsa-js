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
  setShare(id: bigint | number, value: bigint) {
    this.shares[String(id)] = value;
  }
  getShare(id: bigint | number) {
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
  session: Session;
  constructor(id: number, peers: number[], session: Session) {
    this.id = id;
    this.peers = peers;
    this.session = session;
  }
  async connect() {
    // TODO: set mutex to avoid conflicts
    return this.session.register(this.id);

    // TODO: await other peers
    // const isReady = (parties: Set<number>): boolean => {
    //   if (!parties.has(this.id)) return false;
    //   for (let pId of this.peers) {
    //     if (!parties.has(pId)) return false;
    //   }
    //   return true;
    // }
    // while (!isReady(parties)) {
    //   parties = await this.session.onPartiesChange();
    // }
  }
  async disconnect() {
    // TODO: disconnect with peers
  }
  async sendResult(_r: Variable) {
    // TODO: send result to dealer
  }
  async sendShare(v: Variable, peerId: number) {
    return this.session.sendShare(
      peerId, v.name, v.getShare(peerId));
  }
  async ensureShare(v: Variable): Promise<boolean> {
    // TODO: ensure the share has already given by another party.
    const p: Promise<boolean> = new Promise(async (resolve, reject) => {
      const value = await this.session.getShare(this.id, v.name);
      if (value) {
        v.setShare(this.id, value);
        return resolve(true);
      }
      reject("Not Found");
    });
    return p;
  }
}

// Session defines p2p communication interfaces
interface Session {
  register: (id: number) => Promise<Set<number>>;
  getParties: () => Promise<Set<number>>;
  sendShare: (id: number, name: string, value: bigint) => Promise<void>;
  getShare: (id: number, name: string) => Promise<bigint>;
  // onChange: (key: string) => Promise<string>;
}

// LocalStorageSession emulates p2p communications with localStorage
class LocalStorageSession implements Session {
  // constants for local storage keys
  _KEY_PARTIES = 'parties';
  _KEY_VARS = 'vars';
  // session name
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  async onChange(key: string): Promise<string> {
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
    // TODO: take mutex to avoid overrides
    const parties = await this.getParties();
    parties.add(id);
    await this.setParties(parties);
    return parties;
  }
  async getParties(): Promise<Set<number>> {
    return new Set(this.getItem(this._KEY_PARTIES));
  }
  async setParties(parties: Set<number>) {
    this.setItem(this._KEY_PARTIES, Array.from(parties));
  }
  async sendShare(pId: number, name: string, value: bigint) {
    // TODO: base64 encoding
    const key = this.shareKey(pId, name);
    this.setItem(key, String(value));
  }
  async getShare(id: number, name: string): Promise<bigint> {
    // TODO: base64 decoding
    const key = this.shareKey(id, name);
    return BigInt(this.getItem(key));
  }
  shareKey(id: number, name: string): string {
    return `${this._KEY_VARS}/p${id}/${name}`;
  }
  setItem(key: string, value: any) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  getItem(key: string) {
    return JSON.parse(window.localStorage.getItem(key));
  }
  // async onPartiesChange(): Promise<Set<number>> {
  //   return this.onChange(this._KEY_PARTIES).then((parties) => {
  //     return new Set(JSON.parse(parties));
  //   });
  // }
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

export { Variable, Party, MPC, mpCompute, LocalStorageSession };
