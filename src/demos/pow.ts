import { MPC, Secret, Share } from '../lib/mpc';
import { splitAndSend, recieveResult } from './common';

export function dealer(mpc: MPC) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    var x = new Secret('x', 3n);
    console.log(x);
    var z = new Secret('x^k');

    await splitAndSend(mpc, x);
    await recieveResult(mpc, z);

    console.log('Reconstructed', z.reconstruct());
  }
}

export function party(mpc: MPC) {
  return async function(k: number) {
    var x = new Share('x', mpc.p.id);
    var z = new Share('x^k', mpc.p.id);

    // calculate addition
    await mpc.pow(z, x, k);

    // send result to dealer
    await mpc.sendShare(z, mpc.conf.dealer);
  }
}
