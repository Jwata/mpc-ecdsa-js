import { Secret, Share, Party, MPC, LocalStorageSession } from './lib/mpc'

// Expose MPC Lib
declare global {
  interface Window {
    Secret: any;
    Share: any;
    Party: any;
    MPC: any;
    LocalStorageSession: any;
    mpc: MPC;
  }
}
window.Secret = Secret;
window.Share = Share;
window.Party = Party;
window.MPC = MPC;
window.LocalStorageSession = LocalStorageSession;


// Add APIs for demo
function initMPC() {
  const session = LocalStorageSession.init('demo.add');
  const urlParams = new URLSearchParams(window.location.search);
  const pId = Number(urlParams.get('party'));
  const dealer = new Party(pId, session);
  const conf = { n: 3, k: 2 }
  return new MPC(dealer, conf);
};

window.addEventListener('DOMContentLoaded', function() {
  const mpc = initMPC();
  window.mpc = mpc;
});
