import * as secureRandom from '../lib/secure_random';
import * as G from '../lib/finite_field';
import { MPC, Secret, Share, Public } from '../lib/mpc';
import { splitAndSend, recieveResult } from './common';

export function dealer(mpc: MPC) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    const a = new Secret('a', 2n);
    // TODO: generate random in finite field
    const r = new Secret(
      'r', BigInt(secureRandom.getRandomValues(1)[0]) % G.P);
    const t = new Public('t', G.mul(a.value, r.value))
    const a_inv = new Secret('a_inv');

    // broadcast t to all parties
    await mpc.broadcastPublic(t);
    await splitAndSend(mpc, r);
    await recieveResult(mpc, a_inv);

    console.log('reconstructed', a_inv.reconstruct());
    console.log(`a_inv * a = ${G.mul(a_inv.value, a.value)}`);
  }
}

export function party(mpc: MPC) {
  return async function() {
    const t = new Public('t');
    await mpc.recievePublic(t);

    const r = new Share('r', mpc.p.id);
    await mpc.recieveShare(r);

    const a_inv = new Share('a_inv', mpc.p.id);
    a_inv.value = G.mul(G.inv(t.value), r.value);

    mpc.p.sendShare(a_inv, mpc.conf.dealer);
  }
}
