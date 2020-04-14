import * as sss from './shamir_secret_sharing';
import { Variable, Party, LocalStorageSession } from './mpc';

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
    const session = new LocalStorageSession('test');
    const p1 = new Party(1, [1, 2], session);
    const p2 = new Party(2, [1, 3], session);
    const p3 = new Party(3, [2, 3], session);

    // TODO: register in parallel
    await p1.connect();
    await p2.connect();
    await p3.connect();

    // all parties should connect each other
    expect(await p1.session.getParties()).toEqual(new Set([1,2,3]));
    expect(await p2.session.getParties()).toEqual(new Set([1,2,3]));
    expect(await p3.session.getParties()).toEqual(new Set([1,2,3]));

    // prepare secret 'a' and shares
    const a1 = new Variable('a');
    a1.secret = 1n;
    const n = 3;
    const k = 2;
    a1.split(n, k);

    // p1 sends shares to peers
    await p1.sendShare(a1, 2);
    await p1.sendShare(a1, 3);

    // peers should have the shares
    const a2 = new Variable('a')
    expect(await p2.ensureShare(a2)).toBeTrue();
    expect(a2.getShare(2)).toEqual(a1.getShare(2));

    const a3 = new Variable('a')
    expect(await p3.ensureShare(a3)).toBeTrue();
    expect(a3.getShare(3)).toEqual(a1.getShare(3));
  });

  it('ensures share', function() {

  });
})
