import * as _ from 'lodash';

import * as secureRandom from './secure_random';

describe('random256', function() {
  it('generates random 256bits number', function() {
    const num = secureRandom.random256();
    expect(num.toString(2).length).toBeGreaterThan(256 - 32);
  });
})

describe('getRandomValues', function() {
  it('generates random numbers', function() {
    const values = secureRandom.getRandomValues(3);
    expect(values.length).toEqual(3);
    for (let i in values) {
      expect(values[i]).toBeInstanceOf(Number);
    }
    // Each element is expected to be unique
    _.uniq(values)
    expect(values.length).toEqual(3);
  });
});
