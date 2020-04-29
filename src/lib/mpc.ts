import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

// TODO use setter 
//https://blog.neptune-ubi.com/overwriting-getter-setter-in-typescript/
class Secret {
  name: string;
  _value: bigint;
  shares: { [key: string]: Share };
  onCreate: () => void;
  onSetValue: () => void;
  onSetShare: () => void;
  constructor(name: string, secret?: bigint) {
    this.name = name;
    this.shares = {};
    this.value = secret;
    if (this.onCreate) this.onCreate();
  }
  get value() {
    return this._value;
  }
  set value(v: bigint) {
    this._value = v;
    if (this.onSetValue) this.onSetValue();
  }
  setShare(s: Share) {
    this.shares[String(s.index)] = s;
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
      let s = new Share(this.name, Number(idx), v);
      this.setShare(s);
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

class Share {
  name: string;
  index: number;
  _value: bigint;
  onCreate: () => void;
  onSetValue: () => void;
  constructor(name: string, idx: number, value?: bigint) {
    this.name = name;
    this.index = idx;
    if (value) {
      this.value = value;
    }
    if (this.onCreate) this.onCreate();
  }
  get value() {
    return this._value;
  }
  set value(v: bigint) {
    this._value = v;
    if (this.onSetValue) this.onSetValue();
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
  async sendShare(s: Share, peerId: number) {
    console.log(`party.sendShare: party=${this.id} peer=${peerId}`, s);
    const key = this._shareKey(s);
    return this.session.send(peerId, key, String(s.value));
  }
  async receiveShare(s: Share): Promise<boolean> {
    const key = this._shareKey(s);
    return this.session.recieve(this.id, key).then((value: string) => {
      if (!value) throw "no data recieved";
      s.value = BigInt(value);
      console.log(`party.recieveShare: party=${this.id}`, s);
      return true;
    }).catch((e) => {
      console.error(e);
      return false;
    });
  }
  _shareKey(s: Share): string {
    return `vars/${s.name}/shares/${s.index}`;
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
  async sendShare(s: Share, peer: number) {
    return this.p.sendShare(s, peer);
  }
  async recieveShare(s: Share) {
    return this.p.receiveShare(s);
  }
  async add(c: Share, a: Share, b: Share) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    await this.p.receiveShare(b);
    c.value = a.value + b.value;
    return c;
  }
  async mul(c: Share, a: Share, b: Share) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    await this.p.receiveShare(b);


    // calcluate a*b and broadcast shares to peers
    const ab_i = new Secret(
      `${a.name}${b.name}#${this.p.id}`, a.value * b.value);
    for (let [idx, share] of Object.entries(this.split(ab_i))) {
      await this.p.sendShare(share, Number(idx));
    }

    // collect `ab` from peers
    // TODO: await in parallel
    const points: Array<Point> = [];
    for (let j = 1; j <= this.conf.n; j++) {
      let ab_j = new Share(`${a.name}${b.name}#${j}`, this.p.id);
      await this.p.receiveShare(ab_j);
      points.push([BigInt(j), ab_j.value]);
    }

    c.value = sss.reconstruct(points);
    return c;
  }
}

type MPCConfig = {
  n: number,
  k: number,
}

export { Secret, Share, Party, MPC, MPCConfig, LocalStorageSession };
