import { Point } from './lib/polynomial';
import * as sss from './lib/shamir_secret_sharing';

describe('MPC arithmetics', function() {
  it('[a + b] = [a] + [b]', function() {
    const n = 3;
    const k = 3;
    const a = 1n;
    const b = 2n;

    const As = sss.split(a, n, k);
    const Bs = sss.split(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let p = 0; p < n; p++) {
      let A = As[p][1];
      let B = Bs[p][1];
      results.push([BigInt(p+1), A + B])
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

    const As = sss.split(a, n, k);
    const Bs = sss.split(b, n, k);

    const results: Point[] = [];
    // calculate [a] + [b] in each party
    for (let p = 0; p < n; p++) {
      let A = As[p][1];
      let B = Bs[p][1];
      results.push([BigInt(p+1), N*A + M*B])
    }

    expect(sss.reconstruct(results)).toEqual(N*a + M*b)
  });
});
