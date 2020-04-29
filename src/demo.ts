import * as _ from 'lodash';
import { MPC, Party, LocalStorageSession, Share, Secret } from './lib/mpc';
const _css = require('./demo.css');

// Expose MPC Lib
type Variable = Secret | Share;

declare global {
  interface Window {
    mpclib: any;
    variables: Array<Variable>;
    mpc: MPC;
    demoDealer: () => void;
    demoAdd: () => void;
    demoMul: () => void;
  }
}

window.variables = [];

Secret.prototype.onCreate = function() {
  window.variables.push(this);
  renderVariables();
}
Secret.prototype.onSetValue = function() {
  renderVariables();
}
Secret.prototype.onSetShare = function() {
  renderVariables();
}
Share.prototype.onCreate = function() {
  window.variables.push(this);
  renderVariables();
}
Share.prototype.onSetValue = function() {
  renderVariables();
}

// override mpc
const mpclib = {
  Secret: Secret,
  Share: Share,
  Party: Party,
  LocalStorageSession: LocalStorageSession,
  MPC: MPC,
};


window.mpclib = mpclib;

// Dealer uses fixed ID in demo
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

async function splitAndSend(mpc: MPC, s: Secret) {
  console.log('demo: Split and send shares', s);
  for (let [idx, share] of Object.entries(mpc.split(s))) {
    await mpc.sendShare(share, Number(idx));
  }
}

async function recieveResult(mpc: MPC, s: Secret) {
  console.log('Recieve shares', s);
  for (let i = 1; i <= mpc.conf.n; i++) {
    await mpc.recieveShare(s.getShare(i));
  }
  return s;
}

function demoDealer(mpc: MPC) {
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

function demoAdd(mpc: MPC) {
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

function demoMul(mpc: MPC) {
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

function initUI(mpc: MPC) {
  renderParty(mpc);
  renderVariables();
}

function renderParty(mpc: MPC) {
  const el = document.getElementById('party');
  const id = (mpc.p.id == DEALER) ? 'Dealer' : mpc.p.id;
  el.innerHTML = _.template(el.innerText)({ id: id });
}

const variablesHTML = `
<ul>
  <% _.each(variables, function(variable) { %>
    <li><pre><%= prettyPrint(variable) %></pre></li>
  <% }) %>
</ul>
`;


function renderVariables() {
  function prettyPrint(v: Variable): string {
    const dict = {
      name: v.name,
      // TODO: convert to hex string
      value: Number(v.value),
      shares: {},
    }
    const shares: { [key: string]: Number } = {};
    for (let k in (v as Secret).shares) {
      shares[k] = Number((v as Secret).shares[k].value);
    }
    dict.shares = shares;
    if (v instanceof Share) {
      delete dict.shares;
    }
    return v.constructor.name + JSON.stringify(dict, null, 2);
  }

  const vars: { [key: string]: Variable } = {};
  for (let v of window.variables) {
    if (v.name in vars) continue;
    vars[v.name] = v;
  }

  const el = document.getElementById('variables');
  el.innerHTML = _.template(variablesHTML)({
    variables: Object.values(vars), prettyPrint: prettyPrint
  });
}

window.addEventListener('DOMContentLoaded', function() {
  const mpc = initMPC();
  window.mpc = mpc;
  window.demoDealer = demoDealer(mpc);
  window.demoAdd = demoAdd(mpc);
  window.demoMul = demoMul(mpc);

  initUI(mpc);
});
