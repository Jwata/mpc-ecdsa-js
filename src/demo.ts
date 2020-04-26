import * as mpclib from './lib/mpc'

// Expose MPC Lib
declare global {
  interface Window {
    mpclib: any;
    mpc: mpclib.MPC;
    demoDealer: () => void;
    demoAdd: () => void;
    demoMul: () => void;
  }
}
window.mpclib = mpclib;

const DEALER = 999;

// Add APIs for demo
function initMPC() {
  const session = mpclib.LocalStorageSession.init('demo');
  const urlParams = new URLSearchParams(window.location.search);
  const pId = Number(urlParams.get('party'));
  const dealer = new mpclib.Party(pId, session);
  const conf = { n: 3, k: 2 }
  return new mpclib.MPC(dealer, conf);
};

async function splitAndSend(mpc: mpclib.MPC, s: mpclib.Secret) {
  console.log('demo: Split and send shares', s);
  for (let [idx, share] of Object.entries(mpc.split(s))) {
    await mpc.sendShare(share, Number(idx));
  }
}

async function recieveResult(mpc: mpclib.MPC, s: mpclib.Secret) {
  console.log('Recieve shares', s);
  for (let i = 1; i <= mpc.conf.n; i++) {
    await mpc.recieveShare(s.getShare(i));
  }
  return s;
}

function demoDealer(mpc: mpclib.MPC) {
  return async function() {
    // clean localStorage
    mpc.p.session.clear();

    var a = new mpclib.Secret('a', 2n);
    console.log(a);
    var b = new mpclib.Secret('b', 3n);
    console.log(b);
    var c = new mpclib.Secret('c');
    console.log(c);

    await splitAndSend(mpc, a);
    await splitAndSend(mpc, b);
    await recieveResult(mpc, c);
    console.log(c.reconstruct());
  }
}

function demoAdd(mpc: mpclib.MPC) {
  return async function() {
    var a = new mpclib.Share('a', mpc.p.id);
    var b = new mpclib.Share('b', mpc.p.id);
    var c = new mpclib.Share('c', mpc.p.id);

    // calculate addition
    await mpc.add(c, a, b);

    // send result to dealer
    await mpc.sendShare(c, DEALER);
  }
}

function demoMul(mpc: mpclib.MPC) {
  return async function() {
    var a = new mpclib.Share('a', mpc.p.id);
    var b = new mpclib.Share('b', mpc.p.id);
    var c = new mpclib.Share('c', mpc.p.id);

    // calculate addition
    await mpc.mul(c, a, b);

    // send result to dealer
    await mpc.sendShare(c, DEALER);
  }
}

window.addEventListener('DOMContentLoaded', function() {
  const mpc = initMPC();
  window.mpc = mpc;
  window.demoDealer = demoDealer(mpc);
  window.demoAdd = demoAdd(mpc);
  window.demoMul = demoMul(mpc);
});
