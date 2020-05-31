import { Share, Public } from '../lib/mpc';
import { MPCECDsa } from '../lib/ecdsa';

export function dealer(mpc: MPCECDsa) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    var pubkey = new Public('pubkey');
    await mpc.recievePublic(pubkey);

    console.log('Recieved pubkey', pubkey.value);

    // TODO: receive pubkey and sig.
  }
}

export function party(mpc: MPCECDsa) {
  return async function() {
    const m = 'hello mpc ecdsa\n';
    const privkey = new Share('privateKey', mpc.p.id);
    const pubkey = await mpc.keyGen(privkey);
    const sig = await mpc.sign(m, privkey, pubkey);

    // Party 1 sends resutls to dealer.
    if (mpc.p.id == 1) {
      // TODO: searize pubkey and sig and send them to dealer.
      // await mpc.sendPublic(pubkey, mpc.conf.dealer);
      // await mpc.sendPublic(sig, mpc.conf.dealer);
    }
  }
}
