import { Point } from './lib/polynomial';
import * as sss from './lib/shamir_secret_sharing';

describe('MPC arithmetics', function() {
  it('[a + b] = [a] + [b]', function() {
    const n = 3;
    const k = 3;
    const a = 1n;
    const b = 2n;

    const a_shares = sss.split(a, n, k);
    const b_shares = sss.split(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let i = 1; i <= n; i++) {
      let a_i = a_shares[i-1][1];
      let b_i = b_shares[i-1][1];
      results.push([BigInt(i), a_i + b_i])
    }

    expect(sss.reconstruct(results)).toEqual(a+b)
  });

  it('[Na + Mb] = N[a] + M[b]', function() {
    const n = 3;
    const k = 3;
    const a = 1n;
    const b = 2n;
    const N = 10n;
    const M = 30n;

    const a_shares = sss.split(a, n, k);
    const b_shares = sss.split(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let i = 1; i <= n; i++) {
      let a_i = a_shares[i-1][1];
      let b_i = b_shares[i-1][1];
      results.push([BigInt(i), N*a_i + M*b_i])
    }

    expect(sss.reconstruct(results)).toEqual(N*a + M*b)
  });

  // Gennaro-Rabin-Rabin multiplication protocol
  // https://dl.acm.org/doi/10.1145/277697.277716
  it('[ab] = l1[c1] + l2[c2] + l3[c3]', function() {
    const n = 3;
    const k = 2;
    const a = 2n;
    const b = 3n;

    const shares: { [party: string]: {[variable: string]: bigint} } = {
      'p1': {},
      'p2': {},
      'p3': {},
    };

    // share a
    for (let [i, a_i] of sss.split(a, n, k)) {
      let p = `p${i}`;
      shares[p]['a'] = a_i;
    }

    // share b
    for (let [i, b_i] of sss.split(b, n, k)) {
      let p = `p${i}`;
      shares[p]['b'] = b_i;
    }

    // calculate c_i = a_i * b_i and share
    for (let i = 1; i <= n; i++) {
      let p = `p${i}`;
      let c_i = shares[p]['a'] * shares[p]['b'];
      for (let [j, c_ij] of sss.split(c_i, n, k)) {
        shares[`p${j}`][`c${i}`] = c_ij;
      }
    }

    // now each party has shares of c1, c2, c3
    const c_shares: Point[] = [];
    for (let i = 1; i <= n; i++) {
      let x = BigInt(i);
      let p = `p${i}`;
      let d_i = sss.reconstruct([
        [BigInt(1), shares[p]['c1']],
        [BigInt(2), shares[p]['c2']],
        [BigInt(3), shares[p]['c3']],
      ]);
      c_shares.push([x, d_i]);
    }

    expect(sss.reconstruct(c_shares)).toEqual(a*b)
  });
});
