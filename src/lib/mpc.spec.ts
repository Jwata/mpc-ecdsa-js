import * as sinon from 'sinon';
import * as sss from './shamir_secret_sharing';
import { Secret, Share, Party, LocalStorageSession, MPC } from './mpc';

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
    const a = new Secret('a')
    a.setShare(new Share('a', 1, 1n))
    a.setShare(new Share('a', 2, 2n))
    a.setShare(new Share('a', 3, 3n))
    expect(a.getShare(1).value).toEqual(1n)
    expect(a.getShare(2).value).toEqual(2n)
    expect(a.getShare(3).value).toEqual(3n)
  });

  it('splits secret to shares', function() {
    const a = new Secret('a');
    a.value = 1n;

    const n = 3;
    const k = 2;
    a.split(n, k);

    expect(Object.keys(a.shares).length).toEqual(n);

    // secret is reconstructable from k out of the n shares.
    expect(sss.reconstruct([
      [BigInt(1), a.getShare(1).value],
      [BigInt(2), a.getShare(2).value],
      [BigInt(3), a.getShare(3).value],
    ])).toEqual(a.value);

    for (let [i, j] of [[1, 2], [1, 3], [2, 3]]) {
      expect(sss.reconstruct([
        [BigInt(i), a.getShare(i).value],
        [BigInt(j), a.getShare(j).value],
      ])).toEqual(a.value);
    }
  });

  it('reconstructs secret from shares', function() {
    const secret = 1n;
    const n = 3;
    const k = 2;
    const a = new Secret('a');
    for (let [idx, value] of sss.share(secret, n, k)) {
      a.setShare(new Share('a', Number(idx), value));
    }

    expect(a.reconstruct()).toEqual(secret);
    expect(a.value).toEqual(secret);
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
    const a1 = new Secret('a', 1n);

    // p1 sends shares to peers
    for (let [idx, share] of Object.entries(a1.split(3, 2))) {
      if (idx == '1') continue;
      await p1.sendShare(share, Number(idx));
    }


    // peers should have the shares
    const a2 = new Share('a', 2)
    expect(await p2.receiveShare(a2)).toBeTrue();
    expect(a2).toEqual(a1.getShare(2));

    const a3 = new Share('a', 3)
    expect(await p3.receiveShare(a3)).toBeTrue();
    expect(a3).toEqual(a1.getShare(3));
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
    const a1 = new Share('a', 1);
    const received = p1.receiveShare(a1);

    const a2 = new Secret('a', 1n);
    a2.split(3, 2);

    background(() => {
      p2.sendShare(a2.getShare(1), 1);
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
    const conf = { n: 3, k: 2 }

    // All participants connect to the network
    p1.connect();
    p2.connect();
    p3.connect();
    dealer.connect();

    // Each party does calculation
    for (let p of [p1, p2, p3]) {
      background(async () => {
        const mpc = new MPC(p, conf);

        const a = new Share('a', p.id);
        const b = new Share('b', p.id);
        const c = new Share('c', p.id);
        await mpc.add(c, a, b);
        mpc.p.sendShare(c, dealer.id);
      });
    }

    // Dealer sends shares and recieves the computed shares from each party
    await background(async () => {
      const mpc = new MPC(dealer, conf);
      const a = new Secret('a', 2n);
      const b = new Secret('b', 3n);
      const c = new Secret('c');

      // broadcast shares of 'a' and 'b'
      for (let [idx, share] of Object.entries(mpc.split(a))) {
        await dealer.sendShare(share, Number(idx));
      }
      for (let [idx, share] of Object.entries(mpc.split(b))) {
        await dealer.sendShare(share, Number(idx));
      }

      // recieve result shares from parties
      for (let pId of [1, 2, 3]) {
        await dealer.receiveShare(c.getShare(pId));
      }
      expect(c.reconstruct()).toEqual(a.value + b.value);
    });
  });

  it('computes multiplication', async function() {
    const session = LocalStorageSession.init('test_multiplication');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);
    const dealer = new Party(999, session);
    const conf = { n: 3, k: 2 }

    // All participants connect to the network
    p1.connect();
    p2.connect();
    p3.connect();
    dealer.connect();

    // Each party does calculation
    for (let p of [p1, p2, p3]) {
      background(async () => {
        const mpc = new MPC(p, conf);

        const a = new Share('a', p.id);
        const b = new Share('b', p.id);
        const c = new Share('c', p.id);
        await mpc.mul(c, a, b);
        mpc.p.sendShare(c, dealer.id);
      });
    }

    // Dealer sends shares and recieves the computed shares from each party
    await background(async () => {
      const mpc = new MPC(dealer, conf);
      const a = new Secret('a', 2n);
      const b = new Secret('b', 3n);
      const c = new Secret('c');

      // broadcast shares of 'a' and 'b'
      for (let [idx, share] of Object.entries(mpc.split(a))) {
        await dealer.sendShare(share, Number(idx));
      }
      for (let [idx, share] of Object.entries(mpc.split(b))) {
        await dealer.sendShare(share, Number(idx));
      }

      // recieve result shares from parties
      for (let pId of [1, 2, 3]) {
        await dealer.receiveShare(c.getShare(pId));
      }

      expect(c.reconstruct()).toEqual(a.value * b.value);
    });
  });
});
