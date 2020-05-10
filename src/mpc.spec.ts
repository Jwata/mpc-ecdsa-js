import { Point } from './lib/polynomial';
import * as sss from './lib/shamir_secret_sharing';
import * as secureRandom from './lib/secure_random';
import * as G from './lib/finite_field';

describe('MPC arithmetics', function() {
  it('[a + b] = [a] + [b]', function() {
    const n = 3;
    const k = 3;
    const a = 1n;
    const b = 2n;

    const a_shares = sss.share(a, n, k);
    const b_shares = sss.share(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let i = 1; i <= n; i++) {
      let a_i = a_shares[i - 1][1];
      let b_i = b_shares[i - 1][1];
      results.push([BigInt(i), a_i + b_i])
    }

    expect(sss.reconstruct(results)).toEqual(a + b)
  });

  it('[Na + Mb] = N[a] + M[b]', function() {
    const n = 3;
    const k = 3;
    const a = 1n;
    const b = 2n;
    const N = 10n;
    const M = 30n;

    const a_shares = sss.share(a, n, k);
    const b_shares = sss.share(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let i = 1; i <= n; i++) {
      let a_i = a_shares[i - 1][1];
      let b_i = b_shares[i - 1][1];
      results.push([BigInt(i), N * a_i + M * b_i])
    }

    expect(sss.reconstruct(results)).toEqual(N * a + M * b)
  });

  // Gennaro-Rabin-Rabin multiplication protocol
  // https://dl.acm.org/doi/10.1145/277697.277716
  it('[ab] = l1[c1] + l2[c2] + l3[c3]', function() {
    const n = 3;
    const k = 2;
    const a = 2n;
    const b = 3n;

    const shares: { [party: string]: { [variable: string]: bigint } } = {
      'p1': {},
      'p2': {},
      'p3': {},
    };

    // share a
    for (let [i, a_i] of sss.share(a, n, k)) {
      let p = `p${i}`;
      shares[p]['a'] = a_i;
    }

    // share b
    for (let [i, b_i] of sss.share(b, n, k)) {
      let p = `p${i}`;
      shares[p]['b'] = b_i;
    }

    // calculate c_i = a_i * b_i and share
    for (let i = 1; i <= n; i++) {
      let p = `p${i}`;
      let c_i = shares[p]['a'] * shares[p]['b'];
      for (let [j, c_ij] of sss.share(c_i, n, k)) {
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

    expect(sss.reconstruct(c_shares)).toEqual(a * b);
  });

  it('t = r * a, t^-1 * r = r^-1 * a^-1 * r = a^-1', function() {
    const n = 3;
    const k = 2;
    const a = 2n;

    const shares: { [party: string]: { [variable: string]: bigint } } = {
      'p1': {},
      'p2': {},
      'p3': {},
    };

    // TODO: generate random in finite field
    const r = BigInt(secureRandom.getRandomValues(1)[0]) % G.P;
    const t = G.mul(r, a); // t is known by all perties

    // share r
    for (let [i, b_i] of sss.share(r, n, k)) {
      shares[`p${i}`]['r'] = b_i;
    }

    // each party locally calculate t^-1 * r
    const a_inv_shares: Point[] = [];
    for (let i = 1; i <= n; i++) {
      let t_inv = G.inv(t);
      let a_inv_i = t_inv * shares[`p${i}`]['r'];
      a_inv_shares.push([BigInt(i), a_inv_i]);
    }

    // reconstructed a_inv * a mod P should be 1
    expect(G.mul(a, sss.reconstruct(a_inv_shares))).toEqual(1n);
  })
});
