import * as GF from '../lib/finite_field';
import { MPC, Secret, Share, Public } from '../lib/mpc';
import { splitAndSend, recieveResult } from './common';

export function dealer(mpc: MPC) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    const a = new Secret('a', 2n);
    const a_inv = new Secret('a_inv');

    // broadcast t to all parties
    await splitAndSend(mpc, a);
    await recieveResult(mpc, a_inv);

    console.log('reconstructed', a_inv.reconstruct());
    console.log(`a_inv * a = ${GF.mul(a_inv.value, a.value)}`);
  }
}

export function party(mpc: MPC) {
  return async function() {
    const a = new Share('a', mpc.p.id);
    const a_inv = new Share('a_inv', mpc.p.id);

    await mpc.inv(a_inv, a);

    mpc.p.sendShare(a_inv, mpc.conf.dealer);
  }
}
