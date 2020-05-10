import * as _ from 'lodash';
import { MPC, Party, LocalStorageSession, Share, Secret, Variable } from './lib/mpc';
import { P } from './lib/finite_field';
import * as demoInv from './demos/inv';
import * as demoAdd from './demos/add';
import * as demoMul from './demos/mul';
import * as demoPow from './demos/pow';
import './demo.css';


declare global {
  interface Window {
    mpclib: any;
    variables: Array<Variable>;
    mpc: MPC;
    demos: { [key: string]: { [key: string]: Function } };
  }
}

window.variables = [];

Variable.prototype.onCreate = function() {
  window.variables.push(this);
  renderVariables();
}
Variable.prototype.onSetValue = function() {
  renderVariables();
}
Secret.prototype.onSetShare = function() {
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
  const n = Number(urlParams.get('n') || 3);
  const k = Number(urlParams.get('k') || 2);
  const conf = { n: n, k: k, p: P, dealer: DEALER }
  return new mpclib.MPC(dealer, conf);
};

function initUI(mpc: MPC) {
  renderSettings(mpc);
  renderVariables();
}

const settingsTamplate = `
<ul>
  <li>Party: <%= party %></li>
  <li>N: <%= n %></li>
  <li>K: <%= k %></li>
  <li>P: <%= p %></li>
</ul>
`;

function renderSettings(mpc: MPC) {
  const id = (mpc.p.id == DEALER) ? 'Dealer' : mpc.p.id;
  const s = document.getElementById('settings');
  s.innerHTML = _.template(settingsTamplate)(
    { party: id, n: mpc.conf.n, k: mpc.conf.k, p: mpc.conf.p });
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
    if (v.name in vars &&
      v instanceof Share &&
      vars[v.name] instanceof Secret) continue;
    vars[v.name] = v;
  }

  const el = document.getElementById('variables');
  el.innerHTML = _.template(variablesTemplate)({
    variables: Object.values(vars), prettyPrint: prettyPrint
  });
}

window.addEventListener('DOMContentLoaded', function() {
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
  }

  initUI(mpc);
});
