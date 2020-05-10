import { MPC, Secret } from '../lib/mpc';

export async function splitAndSend(mpc: MPC, s: Secret) {
  console.log('demo: Split and send shares', s);
  for (let [idx, share] of Object.entries(mpc.split(s))) {
    await mpc.sendShare(share, Number(idx));
  }
}

export async function recieveResult(mpc: MPC, s: Secret) {
  console.log('Recieve shares', s);
  for (let i = 1; i <= mpc.conf.n; i++) {
    await mpc.recieveShare(s.getShare(i));
  }
  return s;
}
