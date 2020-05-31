import * as _ from 'lodash';
import * as elliptic from 'elliptic';
import * as BN from 'bn.js';
const asn1 = require('asn1.js');

import { sha256 } from '../lib/crypto';
import { Share, Public } from '../lib/mpc';
import { MPCECDsa } from '../lib/ecdsa';
import { renderOutputs } from './common';

const outputsTemplate = `
<ul>
  <li>
    <h4>Public Key <button id="download-pubkey-btn">Download</button></h4>
    <table>
      <tr><td>X</td><td><input type="text" readonly size=66 value="<%= pubX %>"></td></tr>
      <tr><td>Y</td><td><input type="text" readonly size=66 value="<%= pubY %>"></td></tr>
      <tr><td>HEX </td><td><input type="text" readonly size=135 value="<%= pubHex %>"></td></tr>
      <tr><td>HEX compressed</td><td><input type="text" readonly size=70 value="<%= pubCompressedHex %>"></td></tr>
    </table>
  </li>
  <li>
    <h4>Message <button id="download-message-btn">Download</button></h4>
    <table>
      <td>m</td><td><input type="text" readonly value="<%= message %>"></td>
    </table>
  </li>
  <li>
    <h4>Signature <button id="download-sig-btn">Download</button></h4>
    <table>
      <tr><td>r</td><td><input type="text" size=66 readonly value=<%= r %>></td></tr>
      <tr><td>s</td><td><input type="text" size=66 readonly value=<%= s %>></td></tr>
    </table>
  </li>
</ul>
`;

export function party(mpc: MPCECDsa) {
  return async function() {
    const m = 'hello mpc ecdsa\n';
    const h = await sha256(m);

    const privkey = new Share('privateKey', mpc.p.id);
    const pubkey = await mpc.keyGen(privkey);
    const pubkeyHex = pubkey.encode('hex', false);
    const pubkeyCompressedHex = pubkey.encode('hex', true);
    const sig = await mpc.sign(m, privkey, pubkey);

    // const keyPair = mpc.curve.genKeyPair();
    // const pubkey = keyPair.getPublic();
    // const pubkeyHex = keyPair.getPublic('hex');
    // const pubkeyCompressedHex = keyPair.getPublic(true, 'hex');
    // const sig = keyPair.sign(h);

    const html = _.template(outputsTemplate)({
      pubX: pubkey.getX().toJSON(),
      pubY: pubkey.getY().toJSON(),
      pubHex: pubkeyHex,
      pubCompressedHex: pubkeyCompressedHex,
      message: m,
      r: sig.r.toJSON(),
      s: sig.s.toJSON(),
    });
    renderOutputs(html);

    const pubkeyBtn = document.getElementById('download-pubkey-btn');
    pubkeyBtn.addEventListener('click', (_e: MouseEvent) => {
      _downloadPubkeyPEM('mpcecdsa_pub.pem', pubkeyHex);
    });
    const messageBtn = document.getElementById('download-message-btn');
    messageBtn.addEventListener('click', (_e: MouseEvent) => {
      _downloadMessage('message.txt', m);
    });
    const sigDERBtn = document.getElementById('download-sig-btn');
    sigDERBtn.addEventListener('click', async (_e: MouseEvent) => {
      _downloadDER(`mpcecdsa_${h}.sig`, sig);
    });
  }
}

const ASN1PublicKey = asn1.define('ECPublicKey', function() {
  this.seq().obj(
    this.key('algorithm').seq().obj(
      this.key("id").objid(),
      this.key("curve").objid()
    ),
    this.key('pub').bitstr()
  )
});

function _downloadPubkeyPEM(filename: string, pub: string) {
  const pem = ASN1PublicKey.encode({
    algorithm: {
      // ecPublicKey (ANSI X9.62 public key type)
      id: [1, 2, 840, 10045, 2, 1],
      // prime256v1 (ANSI X9.62 named elliptic curve)
      curve: [1, 2, 840, 10045, 3, 1, 7]
    },
    pub: {
      unused: 0,
      data: Buffer.from(pub, 'hex')
    }
  }, 'pem', { label: 'PUBLIC KEY' });

  const textBlob = new Blob([pem], { type: 'text/plain' });
  _downloadFile(filename, textBlob);
}

function _downloadMessage(filename: string, m: string) {
  const textBlob = new Blob([m], { type: 'text/plain' });
  _downloadFile(filename, textBlob);
}

const ASN1DerSig = asn1.define('ECDerSig', function() {
  this.seq().obj(
    this.key('r').int(),
    this.key('s').int(),
  );
});

function _downloadDER(filename: string, sig: elliptic.ec.Signature) {
  const asnDerSig: Uint8Array = ASN1DerSig.encode({
    r: new BN(sig.r.toArray('be', 32)),
    s: new BN(sig.s.toArray('be', 32))
  }, 'der');
  const blob = new Blob([asnDerSig]);
  _downloadFile(filename, blob);
}


function _downloadFile(filename: string, blob: Blob) {
  const el = document.createElement('a');
  el.setAttribute('href', URL.createObjectURL(blob));
  el.setAttribute('download', filename);
  el.style.display = 'none';
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}
