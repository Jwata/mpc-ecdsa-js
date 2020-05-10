/**
 * Implementation of polynomial generation and derivation for SSS
 */
import * as _ from 'lodash';

import * as GF from './finite_field';

interface Polynomial {
  degree: number;
  f(x: number|bigint): bigint;
}

class NormalPolynomial implements Polynomial {
  degree: number;
  coefficients: bigint[];
  constructor(degree: number) {
    this.degree = degree;
    this.coefficients = new Array(degree+1);
  }
  f(x: bigint): bigint {
    let y = 0n;
    for (let i = 0; i <= this.degree; i++) {
      y += this.coefficients[i] * (x ** BigInt(i));
    }
    return y;
  }
}

function getRandomPolynomial(degree: number, y0: bigint): NormalPolynomial {
  let poly = new NormalPolynomial(degree);
  poly.coefficients[0] = y0;
  for (let i = 1; i <= degree; i++) {
    poly.coefficients[i] =GF.rand();
  }
  return poly;
};

type Point = [bigint, bigint];

class LagrangePolynomial implements Polynomial {
  degree: number;
  points: Point[];
  constructor(degree: number) {
    this.degree = degree;
    this.points = new Array<Point>(degree+1);
  }
  f(x: bigint): bigint {
    let y = 0n;
    for (let i = 0; i < this.degree+1; i++) {
      let pi = this.points[i];
      let n = 1n;
      let d = 1n;
      for (let j = 0; j < this.degree+1; j++) {
        if (i == j) continue;
        let pj = this.points[j];
        n = GF.mul(n, GF.add(x, -1n * pj[0]));
        d = GF.mul(d, GF.add(pi[0], -1n * pj[0]));
      }
      let l = GF.mul(n, GF.inv(d));
      y = GF.add(y, GF.mul(pi[1], l))
    }
    return y;
  }
}

function getLagurangePolynomial(points: Point[]): LagrangePolynomial {
  const degree = points.length - 1;
  const poly = new LagrangePolynomial(degree);
  for (let i = 0; i < degree+1; i++) {
    poly.points[i] = points[i];
  }
  return poly;
}


export { Polynomial, NormalPolynomial, getRandomPolynomial, LagrangePolynomial, Point, getLagurangePolynomial}
