import { MPC, Secret, Share } from '../lib/mpc';
import { splitAndSend, recieveResult } from './common';

export function dealer(mpc: MPC) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    var a = new Secret('a', 2n);
    console.log(a);
    var b = new Secret('b', 3n);
    console.log(b);
    var c = new Secret('c');
    console.log(c);

    await splitAndSend(mpc, a);
    await splitAndSend(mpc, b);
    await recieveResult(mpc, c);

    console.log('Reconstructed', c.reconstruct());
  }
}

export function party(mpc: MPC) {
  return async function() {
    var a = new Share('a', mpc.p.id);
    var b = new Share('b', mpc.p.id);
    var c = new Share('c', mpc.p.id);

    // calculate addition
    await mpc.add(c, a, b);

    // send result to dealer
    await mpc.sendShare(c, mpc.conf.dealer);
  }
}
