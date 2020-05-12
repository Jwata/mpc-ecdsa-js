import * as GF from './finite_field';
import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

class Variable {
  name: string;
  _value: bigint;
  onCreate: () => void;
  onSetValue: () => void;
  constructor(name: string, value?: bigint | string) {
    this.name = name;
    if (value) this._value = BigInt(value);
    if (this.onCreate) this.onCreate();
  }
  get value() {
    return this._value;
  }
  set value(v: bigint) {
    this._value = BigInt(v);
    if (this.onSetValue) this.onSetValue();
  }
  toHex(): string {
    return (this._value) ? '0x' + this._value.toString(16) : '';
  }
}

class Secret extends Variable {
  shares: { [key: string]: Share };
  onSetShare: () => void;
  constructor(name: string, value?: bigint | string) {
    super(name, value);
    this.shares = {};
    if (this.onCreate) this.onCreate();
  }
  setShare(idx: bigint | number, value: bigint) {
    const s = new Share(this.name, Number(idx), value);
    this.shares[String(idx)] = s;
    if (this.onSetShare) this.onSetShare();
  }
  getShare(idx: bigint | number): Share {
    const key = String(idx);
    if (!(key in this.shares)) {
      this.shares[key] = new Share(this.name, Number(idx));
    }
    return this.shares[key];
  }
  split(n: number, k: number) {
    for (let [idx, v] of sss.share(this.value, n, k)) {
      this.setShare(idx, v);
    }
    return this.shares;
  }
  reconstruct(): bigint {
    const points: Point[] = [];
    for (let idx in this.shares) {
      points.push([BigInt(idx), this.shares[idx].value]);
    }
    this.value = sss.reconstruct(points);
    return this.value;
  }
}

class Share extends Variable {
  index: number;
  constructor(name: string, idx: number, value?: bigint | string) {
    super(name, value);
    this.index = idx;
    if (this.onCreate) this.onCreate();
  }
}

class Public extends Variable {
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
  async sendShare(s: Share, peerId: number) {
    console.log(`party.sendShare: party=${this.id} peer=${peerId}`, s);
    const key = this._shareKey(s);
    return this.session.send(peerId, key, s.toHex());
  }
  async receiveShare(s: Share): Promise<boolean> {
    const key = this._shareKey(s);
    return this._receive(s, key);
  }
  async sendPublic(p: Public, peerId: number) {
    console.log(`party.sendPublic: party=${this.id} peer=${peerId}`, p);
    const key = this._publicKey(p);
    return this.session.send(peerId, key, p.toHex());
  }
  async receivePublic(p: Public): Promise<boolean> {
    const key = this._publicKey(p);
    return this._receive(p, key);
  }
  async _receive(v: Variable, key: string): Promise<boolean> {
    return this.session.recieve(this.id, key).then((value: string) => {
      if (!value) throw "no data recieved";
      v.value = BigInt(value);
      console.log(`party.recieve: party=${this.id}`, v);
      return true;
    }).catch((e) => {
      console.error(e);
      return false;
    });
  }
  _shareKey(s: Share): string {
    return `vars/${s.name}/shares/${s.index}`;
  }
  _publicKey(p: Public): string {
    return `vars/${p.name}`;
  }
}

// Session defines p2p communication interfaces
interface Session {
  register: (id: number) => Promise<Set<number>>;
  getParties: () => Promise<Set<number>>;
  send: (id: number, key: string, value: any) => Promise<void>;
  recieve: (id: number, key: string) => Promise<string>;
  clear: () => void;
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
  static init(name: string): LocalStorageSession {
    const s = new this(name);
    return s;
  }
  clear() {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      let key = window.localStorage.key(i);
      if (!key.startsWith(this.name)) continue;
      keys.push(key);
    }
    for (let key of keys) {
      window.localStorage.removeItem(key);
    }
    console.debug('mpc.cleared:', keys);
  }
  async register(id: number): Promise<Set<number>> {
    // TODO: take mutex to avoid overrides
    const parties = await this.getParties();
    parties.add(id);
    this.setItem(`${this.name}/${this._KEY_PARTIES}`, Array.from(parties));
    return parties;
  }
  async getParties(): Promise<Set<number>> {
    return new Set(this.getItem(`${this.name}/${this._KEY_PARTIES}`));
  }
  async send(pId: number, key: string, value: any) {
    // TODO: send multiple times
    console.debug(`session.send: key=${this.getStorageKey(pId, key)}, value=${value}`);
    return this.setItem(this.getStorageKey(pId, key), value);
  }
  async recieve(id: number, key: string): Promise<any> {
    const storageKey = this.getStorageKey(id, key);
    const value = this.getItem(storageKey);
    console.debug(`session.recieve: key=${storageKey}, value=${value}`);
    if (value) {
      return value;
    }
    return this.onChange(storageKey);
  }
  getStorageKey(id: number, key: string): string {
    return `${this.name}/p${id}/${key}`;
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
    console.debug(`session.onChange: listening key=${key}`);
    return new Promise((resolve, _reject) => {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.storageArea != localStorage) return;
        if (event.key != key) return;
        console.debug('session.onChange: storageEvent', key, JSON.parse(event.newValue));
        resolve(JSON.parse(event.newValue));
      });
    });
  }
}

// MPC arithmetic APIs
class MPC {
  p: Party;
  conf: MPCConfig;
  constructor(p: Party, conf: MPCConfig) {
    this.p = p;
    this.conf = conf;
  }
  split(s: Secret) {
    return s.split(this.conf.n, this.conf.k);
  }
  // sends a share to a peer.
  async sendShare(s: Share, peer: number) {
    return this.p.sendShare(s, peer);
  }
  // recieves a share from a peer.
  async recieveShare(s: Share) {
    return this.p.receiveShare(s);
  }
  // broadcast a public variable to all peers.
  async broadcastPublic(p: Public) {
    const promisses = [];
    for (let i = 1; i <= this.conf.n; i++) {
      promisses.push(this.p.sendPublic(p, i));
    }
    return Promise.allSettled(promisses);
  }
  async recievePublic(p: Public) {
    return this.p.receivePublic(p);
  }
  // calculate a + b and assign the result to d
  async add(d: Share, a: Share, b: Share) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    await this.p.receiveShare(b);
    d.value = a.value + b.value;
    return d;
  }
  // calculate a * b and assign the result to d
  async mul(d: Share, a: Share, b: Share) {
    // TODO: await in parallel
    if (!a.value) await this.p.receiveShare(a);
    if (!b.value) await this.p.receiveShare(b);

    // calcluate a*b and broadcast shares to peers
    const ab_i = new Secret(
      `${d.name}#${this.p.id}`, a.value * b.value);
    for (let [idx, share] of Object.entries(this.split(ab_i))) {
      await this.p.sendShare(share, Number(idx));
    }

    // collect `ab` from peers
    // TODO: await in parallel
    const points: Array<Point> = [];
    for (let j = 1; j <= this.conf.n; j++) {
      let ab_j = new Share(`${d.name}#${j}`, this.p.id);
      await this.p.receiveShare(ab_j);
      points.push([BigInt(j), ab_j.value]);
    }

    d.value = sss.reconstruct(points);
    return d;
  }
  // calculate a^k and assign the result to d
  async pow(d: Share, a: Share, k: number): Promise<Share> {
    d.value = 1n;
    await this.p.receiveShare(a);
    return this._pow(d, a.name, new Share(`${a.name}^1`, this.p.id, a.value), 1, k);
  }
  async _pow(d: Share, name: String, a: Share, i: number, k: number): Promise<Share> {
    if (k == 1) {
      return d;
    }
    if (k % 2 == 0) {
      const a2 = new Share(`${name}^${i * 2}`, this.p.id);
      await this.mul(a2, a, a);
      if (k / 2 == 1) d.value *= a2.value;
      return this._pow(d, name, a2, i * 2, k / 2);
    } else {
      await this.mul(d, d, a);
      return this._pow(d, name, a, i, k - 1);
    }
  }
  // Distributed random secret generation
  // each party recieves their shares only
  async rand(d: Share): Promise<Share> {
    // Each party randomly generate secret locally and sends shares to peers.
    // Sum of shares at each party is also a share of a secret
    // due to the linarity.
    const ri = new Secret(`${d.name}#${this.p.id}`, GF.rand());
    for (let [idx, share] of Object.entries(this.split(ri))) {
      await this.p.sendShare(share, Number(idx));
    }

    const points: Array<Point> = [];
    for (let j = 1; j <= this.conf.n; j++) {
      let rj = new Share(`${d.name}#${j}`, this.p.id);
      await this.p.receiveShare(rj);
      points.push([BigInt(j), rj.value]);
    }

    d.value = sss.reconstruct(points);
    return d;
  }
  async inv(d: Share, a: Share): Promise<Share> {
    if (!a.value) await this.p.receiveShare(a);

    // randomly generate value to mask.
    const r = new Share(`${d.name}#mask`, this.p.id);
    await this.rand(r);

    const m = new Secret(`${d.name}#masked`);
    await this.mul(m.getShare(this.p.id), a, r);

    // reveal masked value by exchanging shares.
    for (let j = 1; j <= this.conf.n; j++) {
      await this.p.sendShare(m.getShare(this.p.id), Number(j));
    }
    for (let j = 1; j <= this.conf.n; j++) {
      await this.p.receiveShare(m.getShare(j));
    }

    // reconstruct m and calculate m^-1 locally
    const m_inv = GF.inv(m.reconstruct());

    d.value = GF.mul(r.value, m_inv);
    return d;
  }
}

type MPCConfig = {
  n: number,
  k: number,
  p?: bigint,
  dealer?: number,
}

export { Secret, Share, Public, Party, Variable, MPC, MPCConfig, LocalStorageSession };
