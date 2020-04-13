import * as sss from './shamir_secret_sharing';
import { Variable, Party } from './mpc';

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
  it('sends share to peer', function() {
    const id = 1;
    const peers = [2, 3];
    const p = new Party(id, peers);
    p.connect();
  });

  it('ensures share', function() {

  });
})
