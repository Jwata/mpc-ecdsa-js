import * as GF from './finite_field';

function inGFP(x: bigint) {
  return (x >= 0 && x < GF.P)
}

describe('add', function() {
  let x: bigint, y: bigint, z: bigint;
  for ([x, y, z] of [
    [1n, 2n, 3n],
    [GF.P - 1n, 1n, 0n],
    [1n, GF.P - 1n, 0n],
    [GF.P + 1n, GF.P + 1n, 2n],
  ]) {
    it(`${x} + ${y} = ${z} in GF(P)`, function() {
      let xy = GF.add(x, y);
      expect(inGFP(xy)).toBeTrue()
      expect(xy).toEqual(z)
    });
  }
});

describe('mul', function() {
  let x: bigint, y: bigint, z: bigint;
  for ([x, y, z] of [
    [1n, 2n, 2n],
    [GF.P - 2n, 1n, GF.P - 2n],
    [GF.P - 2n, 3n, GF.P - 6n],
    [2n, GF.P - 3n, GF.P - 6n],
    [GF.P - 2n, GF.P - 3n, 6n],
  ]) {
    it(`${x} * ${y} = ${z} in GF(P)`, function() {
      let xy = GF.mul(x, y);
      expect(inGFP(xy)).toBeTrue();
      expect(xy).toEqual(z);
    });
  }
});

describe('inv', function() {
  const r = GF.rand();
  for (let x of [1n, GF.P - 1n, r]) {
    it(`invserses ${x} in GF(P)`, function() {
      let xInv = GF.inv(x);
      expect(inGFP(xInv)).toBeTrue();
      expect(GF.mul(x, xInv)).toEqual(1n)
    });
  }
});

describe('rand', function() {
  it('generates random number in finite field', function() {
    const r = GF.rand();
    expect(inGFP(r)).toBeTrue();
    expect(r.toString(2).length).toBeGreaterThan(256 - 32);
  });
});
