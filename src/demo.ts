import * as _ from 'lodash';
import * as _mpclib from './lib/mpc';
const _css = require('./demo.css');

// Expose MPC Lib
type Variable = _mpclib.Secret | _mpclib.Share;

declare global {
  interface Window {
    mpclib: any;
    variables: Array<Variable>;
    mpc: _mpclib.MPC;
    demoDealer: () => void;
    demoAdd: () => void;
    demoMul: () => void;
  }
}

// MPC variables used in demo
class Variables extends Array<Variable> implements Array<Variable> {
  push(...variables: Array<Variable>): number {
    // TODO: proxy setter
    return super.push(...items);
  }
}
window.variables = new Variables();

// Extend mpc Secret and Share to observe new variables
class Secret extends _mpclib.Secret {
  constructor(name: string, secret?: bigint) {
    super(name, secret);
    window.variables.push(this);
  }
}
class Share extends _mpclib.Share {
  constructor(name: string, idx: number, value?: bigint) {
    super(name, idx, value);
    window.variables.push(this);
  }
}

// override mpc
const mpclib = {
  Secret: Secret,
  Share: Share,
  Party: _mpclib.Party,
  LocalStorageSession: _mpclib.LocalStorageSession,
  MPC: _mpclib.MPC,
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

async function splitAndSend(mpc: _mpclib.MPC, s: _mpclib.Secret) {
  console.log('demo: Split and send shares', s);
  for (let [idx, share] of Object.entries(mpc.split(s))) {
    await mpc.sendShare(share, Number(idx));
  }
}

async function recieveResult(mpc: _mpclib.MPC, s: _mpclib.Secret) {
  console.log('Recieve shares', s);
  for (let i = 1; i <= mpc.conf.n; i++) {
    await mpc.recieveShare(s.getShare(i));
  }
  return s;
}

function demoDealer(mpc: _mpclib.MPC) {
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

function demoAdd(mpc: _mpclib.MPC) {
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

function demoMul(mpc: _mpclib.MPC) {
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

function initUI(mpc: _mpclib.MPC) {
  renderParty(mpc);
  renderVariables();
}

function renderParty(mpc: _mpclib.MPC) {
  const el = document.getElementById('party');
  const id = (mpc.p.id == DEALER) ? 'Dealer' : mpc.p.id;
  el.innerHTML = _.template(el.innerText)({ id: id });
}

const variablesHTML = `
<ul>
  <% _.each(variables, function(variable) { %>
    <li><pre><%= variable.prettyPrint() %></pre></li>
  <% }) %>
</ul>
`;

function renderVariables() {
  const el = document.getElementById('variables');
  el.innerHTML = _.template(variablesHTML)({ variables: window.variables });
}

window.addEventListener('DOMContentLoaded', function() {
  const mpc = initMPC();
  window.mpc = mpc;
  window.demoDealer = demoDealer(mpc);
  window.demoAdd = demoAdd(mpc);
  window.demoMul = demoMul(mpc);

  initUI(mpc);
});
