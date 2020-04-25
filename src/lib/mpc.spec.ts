import * as sinon from 'sinon';
import * as sss from './shamir_secret_sharing';
import { Variable, Party, LocalStorageSession, MPC } from './mpc';

// TODO: move to setup and recover teardown
(function emulateStorageEvent() {
  const origSetItem = window.localStorage.setItem;
  sinon.stub(window.localStorage, 'setItem').callsFake((k: string, v: string) => {
    const event: StorageEventInit = {
      storageArea: localStorage,
      key: k,
      newValue: v,
      oldValue: null,
    }
    console.debug('dispatching event');
    window.dispatchEvent(new StorageEvent('storage', event))
    origSetItem.apply(window.localStorage, [k, v]);
  });
})();

async function background(f: () => void, delay: number = 0) {
  return new Promise((resolve, _reject) => {
    const id = setInterval(() => {
      clearInterval(id);
      resolve(f());
    }, delay);
  });
}

describe('Variable', function() {
  it('holds sahres', function() {
    const a = new Variable('a')
    a.setShare(1, 1n)
    a.setShare(2, 2n)
    a.setShare(3, 3n)
    expect(a.getShare(1)).toEqual(1n)
    expect(a.getShare(2)).toEqual(2n)
    expect(a.getShare(3)).toEqual(3n)
  });

  it('splits secret to shares', function() {
    const a = new Variable('a');
    a.secret = 1n;

    const n = 3;
    const k = 2;
    a.split(n, k);

    expect(Object.keys(a.shares).length).toEqual(n);

    // secret is reconstructable from k out of the n shares.
    expect(sss.reconstruct([
      [BigInt(1), a.getShare(1)],
      [BigInt(2), a.getShare(2)],
      [BigInt(3), a.getShare(3)],
    ])).toEqual(a.secret);

    for (let [i, j] of [[1, 2], [1, 3], [2, 3]]) {
      expect(sss.reconstruct([
        [BigInt(i), a.getShare(i)],
        [BigInt(j), a.getShare(j)],
      ])).toEqual(a.secret);
    }
  });

  it('reconstructs secret from shares', function() {
    const secret = 1n;
    const n = 3;
    const k = 2;
    const a = new Variable('a');
    for (let [id, value] of sss.share(secret, n, k)) {
      a.setShare(id, value);
    }

    expect(a.reconstruct()).toEqual(secret);
    expect(a.secret).toEqual(secret);
  });
});
describe('Party', function() {
  it('sends share to peer', async function() {
    const session = LocalStorageSession.init('test');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);

    // TODO: register in parallel
    await p1.connect();
    await p2.connect();
    await p3.connect();

    // all parties should connect each other
    expect(await p1.session.getParties()).toEqual(new Set([1, 2, 3]));
    expect(await p2.session.getParties()).toEqual(new Set([1, 2, 3]));
    expect(await p3.session.getParties()).toEqual(new Set([1, 2, 3]));

    // prepare secret 'a' and shares
    const a1 = new Variable('a', 1n);
    a1.split(3, 2);

    // p1 sends shares to peers
    await p1.sendShare(2, a1);
    await p1.sendShare(3, a1);

    // peers should have the shares
    const a2 = new Variable('a')
    expect(await p2.receiveShare(a2)).toBeTrue();
    expect(a2.getShare(2)).toEqual(a1.getShare(2));

    const a3 = new Variable('a')
    expect(await p3.receiveShare(a3)).toBeTrue();
    expect(a3.getShare(3)).toEqual(a1.getShare(3));
  });

  it('recieves share', async function() {
    const session = LocalStorageSession.init('test');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);

    // TODO: register in parallel
    await p1.connect();
    await p2.connect();
    await p3.connect();

    // Party1 waits a share of 'a'
    const a1 = new Variable('a');
    const received = p1.receiveShare(a1);

    const a2 = new Variable('a', 1n);
    a2.split(3, 2);

    background(() => {
      p2.sendShare(1, a2);
    });

    expect(await received).toBeTrue();
  });
});

describe('MPC', function() {
  it('computes addition', async function() {
    const session = LocalStorageSession.init('test_addition');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);
    const dealer = new Party(999, session);
    const conf = { n: 3, k: 2, dist: dealer.id }

    // All participants connect to the network
    p1.connect();
    p2.connect();
    p3.connect();
    dealer.connect();

    // Each party does calculation
    for (let p of [p1, p2, p3]) {
      background(async () => {
        const mpc = new MPC(p, conf);

        const a = new Variable('a');
        const b = new Variable('b');
        const c = new Variable('c');
        await mpc.add(c, a, b);
        mpc.p.sendShare(dealer.id, c, p.id);
      });
    }

    // Dealer sends shares and recieves the computed shares from each party
    await background(async () => {
      const a = new Variable('a', 2n);
      const b = new Variable('b', 3n);
      const c = new Variable('c');

      // broadcast shares of 'a' and 'b'
      a.split(3, 2);
      b.split(3, 2);
      for (let pId of [1, 2, 3]) {
        await dealer.sendShare(pId, a);
        await dealer.sendShare(pId, b);
      }

      for (let pId of [1, 2, 3]) {
        await dealer.receiveShare(c, pId);
      }
      expect(c.reconstruct()).toEqual(a.secret + b.secret);
    });
  });

  it('computes multiplication', async function() {
    const session = LocalStorageSession.init('test_multiplication');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);
    const dealer = new Party(999, session);
    const conf = { n: 3, k: 2, dist: dealer.id }

    // All participants connect to the network
    p1.connect();
    p2.connect();
    p3.connect();
    dealer.connect();

    // Each party does calculation
    for (let p of [p1, p2, p3]) {
      background(async () => {
        const mpc = new MPC(p, conf);

        const a = new Variable('a');
        const b = new Variable('b');
        const c = new Variable('c');

        await mpc.mul(c, a, b);
        mpc.p.sendShare(dealer.id, c, p.id);
      });
    }

    // Dealer sends shares and recieves the computed shares from each party
    await background(async () => {
      const a = new Variable('a', 2n);
      const b = new Variable('b', 3n);
      const c = new Variable('c');

      // broadcast shares of 'a' and 'b'
      a.split(3, 2);
      b.split(3, 2);
      for (let pId of [1, 2, 3]) {
        await dealer.sendShare(pId, a);
        await dealer.sendShare(pId, b);
      }

      for (let pId of [1, 2, 3]) {
        await dealer.receiveShare(c, pId);
      }
      expect(c.reconstruct()).toEqual(a.secret * b.secret);
    });
  });
});
