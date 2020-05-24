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

fdescribe('sha256', function() {
  it('calculates sha256 hash from string message', async function() {
    const m = 'hello mpc ecdsa';
    const hashBuffer = await sha256(m);

    // convert array buffer to hex
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    expect(hashHex).toEqual('853b16f3891d1d6d3d2faedf63b2e345de11962ebca485e5f5edae5c6ea3525a');
  });
});
