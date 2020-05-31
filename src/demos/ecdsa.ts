import * as _ from 'lodash';
import * as elliptic from 'elliptic';
import * as BN from 'bn.js';
const asn1 = require('asn1.js');
const KeyEncoder = require('key-encoder').default;

import { sha256 } from '../lib/crypto';
import { Public } from '../lib/mpc';
import { MPCECDsa } from '../lib/ecdsa';
import { renderOutputs } from './common';

export function dealer(mpc: MPCECDsa) {
  return async function() {
    var pubkey = new Public('pubkey');
    await mpc.recievePublic(pubkey);

    console.log('Recieved pubkey', pubkey.value);
  }
}

const outputsTemplate = `
<ul>
  <li><span>Public Key: </span><button id="download-pubkey-btn">Download</button></li>
  <li><p>Message: "<%= message %>"</p></li>
  <li>
    <span>Signature: </span><button id="download-sigder-btn">Download</button>
    <p>r:<%= r %></p>
    <p>s:<%= s %></p>
  </li>
</ul>
`;

export function party(mpc: MPCECDsa) {
  return async function() {
    const m = 'hello mpc ecdsa\n';
    const encoder = new TextEncoder();
    const data = encoder.encode(m);
     window.crypto.subtle.digest('SHA-256', data);
    const h = await sha256(m);

    // const privkey = new Share('privateKey', mpc.p.id);
    // const pubkey = await mpc.keyGen(privkey);
    // const pubkeyHex = pubkey.encode('hex', false);
    // const sig = await mpc.sign(m, privkey, pubkey);
    //
    const keyPair = mpc.curve.genKeyPair();
    const pubkeyHex = keyPair.getPublic('hex');
    const sig = keyPair.sign(h);

    const html = _.template(outputsTemplate)({
      message: m,
      r: sig.r.toJSON(),
      s: sig.s.toJSON(),
    });
    renderOutputs(html);

    const pubkeyBtn = document.getElementById('download-pubkey-btn');
    pubkeyBtn.addEventListener('click', (_e: MouseEvent) => {
      _downloadPubkeyPEM('mpcecdsa_pub.pem', pubkeyHex);
    });
    const sigDERBtn = document.getElementById('download-sigder-btn');
    sigDERBtn.addEventListener('click', (_e: MouseEvent) => {
      _downloadDER(`mpcecdsa_${h}.sig`, sig);
    });
  }
}

// function _toBase64(der: Array<number>): string {
//   return btoa(der.map((b) => String.fromCharCode(b)).join(''));
// }

const ASN1DerSig = asn1.define('ECDerSig', function() {
  this.seq().obj(
    this.key('r').int(),
    this.key('s').int(),
  );
});

function _downloadDER(filename: string, sig: elliptic.ec.Signature) {
  const asnDerSig: Uint8Array = ASN1DerSig.encode(
    {
      r: new BN(sig.r.toArray('be', 32)),
      s: new BN(sig.s.toArray('be', 32))
    }, 'der');
  const blob = new Blob([asnDerSig]);
  const el = document.createElement('a');
  el.setAttribute('href', URL.createObjectURL(blob));
  el.setAttribute('download', filename);
  el.style.display = 'none';
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

function _downloadPubkeyPEM(filename: string, pub: string) {
  const keyEncoder = new KeyEncoder('secp256k1');
  const pem = keyEncoder.encodePublic(pub, 'raw', 'pem');
  // let pem = '-----BEGIN PUBLIC KEY-----\n';
  // pem += _.chunk(pub, 64).map(c => c.join('')).join('\n');
  // pem += '\n-----END PUBLIC KEY-----';

  const textBlob = new Blob([pem], { type: 'text/plain' });
  const el = document.createElement('a');
  el.setAttribute('href', URL.createObjectURL(textBlob));
  el.setAttribute('download', filename);
  el.style.display = 'none';
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}
