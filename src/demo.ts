import * as _ from 'lodash';
import * as elliptic from 'elliptic';
import * as BN from 'bn.js';

import * as sss from './lib/shamir_secret_sharing';
import * as GF from './lib/finite_field';
import { MPC, Party, LocalStorageSession, Share, Secret, Variable } from './lib/mpc';
import * as ecdsa from './lib/ecdsa';
import * as demoInv from './demos/inv';
import * as demoAdd from './demos/add';
import * as demoMul from './demos/mul';
import * as demoPow from './demos/pow';
import * as demoECDSA from './demos/ecdsa';
import './demo.css';


declare global {
  interface Window {
    mpclib: any;
    MPCVars: { [key: string]: Variable };
    mpc: MPC;
    demos: { [key: string]: { [key: string]: Function } };
    GF: any;
    sss: any;
    elliptic: any;
    BN: any;
  }
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

window.GF = GF;

window.sss = sss;

window.elliptic = elliptic;

window.BN = BN;

window.MPCVars = {};

Variable.prototype.onCreate = function() {
  const oldVar = window.MPCVars[this.name];
  if (!oldVar
    || this instanceof Secret
    || !(this instanceof Secret) && !(oldVar instanceof Secret)) {
    window.MPCVars[this.name] = this;
  }
  renderVariables();
}
Variable.prototype.onSetValue = function() {
  renderVariables();
}
Secret.prototype.onSetShare = function() {
  renderVariables();
}

// Dealer uses fixed ID in demo
const DEALER = 999;

// Add APIs for demo
function initMPC() {
  const session = mpclib.LocalStorageSession.init('demo');
  const urlParams = new URLSearchParams(window.location.search);
  const pId = Number(urlParams.get('party'));
  const p = new mpclib.Party(pId, session);
  p.connect();
  const n = Number(urlParams.get('n') || 3);
  const k = Number(urlParams.get('k') || 2);
  const conf = { n: n, k: k, N: GF.N, dealer: DEALER }
  const ec = new elliptic.ec('p256');
  return new ecdsa.MPCECDsa(p, conf, ec);
};

function initUI(mpc: MPC) {
  addResetEvent(mpc);
  renderSettings(mpc);
  renderVariables();
}

function addResetEvent(mpc: MPC) {
  const resetBtn = document.getElementById('reset-btn');
  resetBtn.addEventListener('click', (_e: MouseEvent) => {
    mpc.p.session.clear();
    window.MPCVars = {};
    init();
  });
}

const settingsTamplate = `
<ul>
  <li>Party: <%= party %></li>
  <li>N: <%= n %></li>
  <li>K: <%= k %></li>
  <li>GF.N: <%= N %></li>
</ul>
`;

function renderSettings(mpc: MPC) {
  const id = (mpc.p.id == DEALER) ? 'Dealer' : mpc.p.id;
  const s = document.getElementById('settings');
  const N = '0x' + mpc.conf.N.toString(16);
  s.innerHTML = _.template(settingsTamplate)(
    { party: id, n: mpc.conf.n, k: mpc.conf.k, N: N });
}

const variablesTemplate = `
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
      value: v.toHex(),
      shares: {},
    }
    const shares: { [key: string]: string } = {};
    for (let k in (v as Secret).shares) {
      const s = (v as Secret).shares[k];
      shares[k] = (s) ? s.toHex() : '';
    }
    dict.shares = shares;
    if (v instanceof Share) {
      delete dict.shares;
    }
    return v.constructor.name + JSON.stringify(dict, null, 2);
  }

  const el = document.getElementById('variables');
  el.innerHTML = _.template(variablesTemplate)({
    variables: Object.values(window.MPCVars), prettyPrint: prettyPrint
  });
}

function init() {
  const mpc = initMPC();
  window.mpc = mpc;
  window.demos = {
    add: {
      dealer: demoAdd.dealer(mpc),
      party: demoAdd.party(mpc),
    },
    mul: {
      dealer: demoMul.dealer(mpc),
      party: demoMul.party(mpc),
    },
    inv: {
      dealer: demoInv.dealer(mpc),
      party: demoInv.party(mpc),
    },
    pow: {
      dealer: demoPow.dealer(mpc),
      party: demoPow.party(mpc),
    },
    ecdsa: {
      party: demoECDSA.party(mpc),
    },
  }
  initUI(mpc);
}

window.addEventListener('DOMContentLoaded', function() {
  init();
});
