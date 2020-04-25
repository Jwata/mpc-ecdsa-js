import * as sss from './shamir_secret_sharing';
import { Point } from './polynomial';

class Variable {
  name: string;
  secret: bigint;
  shares: { [x: string]: bigint };
  constructor(name: string, secret?: bigint | number) {
    this.name = name;
    this.shares = {};
    if (secret) {
      this.secret = BigInt(secret);
    }
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
    return this.shares;
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
  async sendShare(pId: number, v: Variable, shareId?: number) {
    if (!shareId) shareId = pId;
    console.debug(`party.sendShare: from=${this.id} to=${pId} name=${v.name} value=${v.getShare(shareId)}, shareID:${shareId}`);
    const key = this._shareKey(v.name, shareId);
    return this.session.send(pId, key, String(v.getShare(shareId)));
  }
  async receiveShare(v: Variable, shareId?: number): Promise<boolean> {
    if (!shareId) shareId = this.id;
    const key = this._shareKey(v.name, shareId);
    return this.session.recieve(this.id, key).then((value: string) => {
      if (!value) throw "no data recieved";
      v.setShare(shareId, BigInt(value));
      console.debug(`party.recieveShare: party=${this.id}, key=${key}, val=${value}`);
      return true;
    }).catch((e) => {
      console.error(e);
      return false;
    });
  }
  _shareKey(name: string, id: number): string {
    return `vars/${name}/shares/${id}`;
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
  static init(name: string): LocalStorageSession {
    this.clearItems();
    return new this(name);
  }
  static clearItems() {
    for (let i = 0; i < window.localStorage.length; i++) {
      let key = window.localStorage.key(i);
      if (!key.startsWith(this.name)) continue;
      window.localStorage.removeItem(key);
    }
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
  split(v: Variable) {
    return v.split(this.conf.n, this.conf.k);
  }
  async add(c: Variable, a: Variable, b: Variable) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    await this.p.receiveShare(b);
    let cValue = a.getShare(this.p.id) + b.getShare(this.p.id);
    return c.setShare(this.p.id, cValue);
  }
  async mul(c: Variable, a: Variable, b: Variable) {
    // TODO: await in parallel
    await this.p.receiveShare(a);
    await this.p.receiveShare(b);

    const abLocalVal = a.getShare(this.p.id) * b.getShare(this.p.id);
    const abLocal = new Variable(`${a.name}${b.name}#${this.p.id}`, abLocalVal);
    this.split(abLocal)

    // broadcast shares of `ab` to peers
    // TODO: await in parallel
    for (let pId in abLocal.shares) {
      await this.p.sendShare(Number(pId), abLocal);
    }

    // collect `ab` from peers
    // TODO: await in parallel
    const ab = new Variable(`${a.name}${b.name}`);
    for (let i = 1; i <= this.conf.n; i++) {
      let abRemote = new Variable(`${a.name}${b.name}#${i}`);
      await this.p.receiveShare(abRemote);
      ab.setShare(i, abRemote.getShare(this.p.id))
    }

    return c.setShare(this.p.id, ab.reconstruct())
  }
}

type MPCConfig = {
  n: number,
  k: number,
}

export { Variable, Party, MPC, MPCConfig, LocalStorageSession };
