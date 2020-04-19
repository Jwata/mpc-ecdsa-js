import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

class Variable {
  name: string;
  secret: bigint;
  shares: { [x: string]: bigint };
  constructor(name: string, secret?: bigint) {
    this.name = name;
    this.shares = {};
    this.secret = secret;
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
  // party ID
  id: number;
  session: Session;
  constructor(id: number, session: Session) {
    this.id = id;
    this.session = session;
  }
  async connect() {
    // TODO: set mutex to avoid conflicts
    return this.session.register(this.id);
  }
  async disconnect() {
    // TODO: disconnect with peers
  }
  async sendResult(_r: Variable) {
    // TODO: send result to dealer
  }
  async sendShare(v: Variable, peerId: number) {
    return this.session.send(
      peerId, v.name, String(v.getShare(peerId)));
  }
  async receiveShare(v: Variable): Promise<boolean> {
    return this.session.recieve(this.id, v.name).then((value: string) => {
      if (!value) throw "no data recieved";
      v.setShare(this.id, BigInt(value));
      return true;
    });
  }
}

// Session defines p2p communication interfaces
interface Session {
  register: (id: number) => Promise<Set<number>>;
  getParties: () => Promise<Set<number>>;
  send: (id: number, key: string, value: any) => Promise<void>;
  recieve: (id: number, key: string) => Promise<string>;
}

// TODO: implement indexdb + observers to be atomic.
// class IndexDBSession implements Session {
// }

// LocalStorageSession emulates p2p communications with localStorage
class LocalStorageSession implements Session {
  // constants for local storage keys
  _KEY_PARTIES = 'parties';
  // session name
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  async register(id: number): Promise<Set<number>> {
    // TODO: take mutex to avoid overrides
    const parties = await this.getParties();
    parties.add(id);
    this.setItem(this._KEY_PARTIES, Array.from(parties));
    return parties;
  }
  async getParties(): Promise<Set<number>> {
    return new Set(this.getItem(this._KEY_PARTIES));
  }
  async send(pId: number, key: string, value: any) {
    // TODO: send multiple times
    console.log('send', pId, key, value);
    return this.setItem(this.getStorageKey(pId, key), value);
  }
  async recieve(id: number, key: string): Promise<any> {
    const storageKey = this.getStorageKey(id, key);
    const value = this.getItem(storageKey);
    console.log('recieve', value);
    if (value) {
      return value;
    }
    return this.onChange(storageKey);
  }
  getStorageKey(id: number, key: string): string {
    return `p${id}/${key}`;
  }
  setItem(key: string, value: any) {
    if (!value) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  getItem(key: string) {
    const v = JSON.parse(window.localStorage.getItem(key));
    return v;
  }
  onChange(key: string): Promise<string> {
    console.log('onChange event listening', key);
    return new Promise((resolve, _reject) => {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.storageArea != localStorage) return;
        if (event.key != key) return;
        console.log('storageEvent', key, event.newValue);
        resolve(JSON.parse(event.newValue));
      });
    });
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
  static async compute(
    p: Party, n: number, k: number, func: (mpc: MPC) => Promise<Variable>
  ) {
    const mpc = new MPC(p, n, k);
    p.connect();
    const result = await func(mpc);
    console.log(result);
    p.sendResult(result);
    p.disconnect();
  }
  async add(c: Variable, a: Variable, b: Variable) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    console.log(a);
    await this.p.receiveShare(b);
    console.log(b);
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
      await this.p.receiveShare(abRemote);
      ab.setShare(i, abRemote.getShare(i))
    }

    return c.setShare(this.p.id, ab.reconstruct())
  }
}

type MPCConfig = {
  n: number,
  k: number,
}

export { Variable, Party, MPC, LocalStorageSession };
