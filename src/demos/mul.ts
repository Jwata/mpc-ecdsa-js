import { MPC, Share } from '../lib/mpc';
import * as demoAdd from './add';

export const dealer = demoAdd.dealer;

export function party(mpc: MPC) {
  return async function() {
    var a = new Share('a', mpc.p.id);
    var b = new Share('b', mpc.p.id);
    var c = new Share('c', mpc.p.id);

    // calculate addition
    await mpc.mul(c, a, b);

    // send result to dealer
    await mpc.sendShare(c, mpc.conf.dealer);
  }
}
