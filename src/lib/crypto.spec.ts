import * as _ from 'lodash';

import { secureRandom256, getRandomValues, sha256 } from './crypto';

describe('secureRandom256', function() {
  it('generates random 256bits number', function() {
    const num = secureRandom256();
    expect(num.toString(2).length).toBeGreaterThan(256 - 32);
  });
})

describe('getRandomValues', function() {
  it('generates random numbers', function() {
    const values = getRandomValues(3);
    expect(values.length).toEqual(3);
    for (let i in values) {
      expect(values[i]).toBeInstanceOf(Number);
    }
    // Each element is expected to be unique
    _.uniq(values)
    expect(values.length).toEqual(3);
  });
});

describe('sha256', function() {
  it('calculates sha256 hash from string message', async function() {
    const m = 'hello mpc ecdsa\n';
    const h = await sha256(m);

    expect(h).toEqual('4e1694b1466ee6dfa0267288e425648403faa2377d623a8c1824794a9e0935c3');
  });
});
