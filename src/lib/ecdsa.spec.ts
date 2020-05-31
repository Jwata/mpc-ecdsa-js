import * as elliptic from 'elliptic';
const Signature = require('elliptic/lib/elliptic/ec/signature');

import * as GF from './finite_field';
import { Secret, Share, MPC } from './mpc';
import * as ecdsa from './ecdsa';
import { emulateStorageEvent, background, expectToBeReconstructable, setupParties } from './test_utils';

// elliptic curve
const ec = new elliptic.ec('p256');

function expectToBeReconstructablePubkey(priv: Secret, points: Array<[number, ecdsa.ECPoint]>) {
  const keyPair = ec.keyFromPrivate(priv.value.toString(16), 'hex');
  const pubExpected = keyPair.getPublic();
  expect(keyPair.getPrivate('hex')).toEqual(priv.value.toString(16));
  expect(priv.value < ecdsa.N).toBeTruthy('Private key should be smaller than G.N');

  expect(pubExpected.eq(ecdsa.reconstruct(points))).toBeTruthy('Failed to reconstruct pubkey from shares 1,2,3');
  expect(pubExpected.eq(ecdsa.reconstruct([points[0], points[1]]))).toBeTruthy('Failed to reconstruct pubkey from share 1,2');
  expect(pubExpected.eq(ecdsa.reconstruct([points[0], points[2]]))).toBeTruthy('Failed to reconstruct pubkey from share 1,3');
  expect(pubExpected.eq(ecdsa.reconstruct([points[1], points[2]]))).toBeTruthy('Failed to reconstruct pubkey from share 2,3');
}

// Verify signature using Web crypto API.
async function expectToVerify(pubkey: ecdsa.ECPoint, sig: elliptic.ec.Signature, message: string) {
  const algo = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
  const importedPubkey = await window.crypto.subtle.importKey(
    'raw', new Uint8Array(pubkey.encode('array', false)), algo, true, ['verify']);
  const sigArray = sig.r.toArray('be', 32).concat(sig.s.toArray('be', 32));
  const verified = await window.crypto.subtle.verify(
    algo, importedPubkey, new Uint8Array(sigArray), new TextEncoder().encode(message));
  expect(verified).toBeTruthy();
}

describe('MPCEC', function() {
  let stubCleanup: Function;
  beforeAll(function() {
    stubCleanup = emulateStorageEvent();
  });
  afterAll(function() {
    stubCleanup();
  });
  describe('reconstruct', function() {
    it('reconstructs pubkey from shares', async function() {
      setupParties(this, 'test_ec_reconstruct');

      // Party
      for (let p of this.parties) {
        background(async () => {
          const mpc = new MPC(p, this.conf);

          // generate priv key shares
          const priv = new Share('priv', p.id);
          await mpc.p.receiveShare(priv);

          // calcluate Pub = priv * G locally
          const privHex = priv.value.toString(16);
          const keyPair = ec.keyFromPrivate(privHex, 'hex');

          const pub = keyPair.getPublic();
          const x = pub.getX().toJSON()
          const pubX = new Share('pubX', p.id, `0x${x}`);
          const y = pub.getY().toJSON()
          const pubY = new Share('pubY', p.id, `0x${y}`);

          await mpc.p.sendShare(pubX, this.dealer.id);
          await mpc.p.sendShare(pubY, this.dealer.id);
        });
      }

      // Dealer
      await background(async () => {
        const mpc = new MPC(this.dealer, this.conf);

        const priv = new Secret('priv', GF.rand());
        for (let [idx, share] of Object.entries(mpc.split(priv))) {
          await mpc.sendShare(share, Number(idx));
        }

        const pubX = new Secret('pubX');
        const pubY = new Secret('pubY');
        // recieve result shares from parties
        const points: Array<[number, ecdsa.ECPoint]> = [];
        for (let pId of [1, 2, 3]) {
          await mpc.p.receiveShare(pubX.getShare(pId));
          await mpc.p.receiveShare(pubY.getShare(pId));
          const P = ec.keyFromPublic({
            x: pubX.getShare(pId).value.toString(16),
            y: pubY.getShare(pId).value.toString(16)
          }).getPublic();
          points.push([pId, P]);
        }

        expectToBeReconstructablePubkey(priv, points);
      });
    });
  });
  describe('keyGen', function() {
    it('generates private key shares', async function() {
      setupParties(this, 'test_ec_keygen');

      const futures = [];
      for (let p of this.parties) {
        const future = background(async () => {
          const mpc = new ecdsa.MPCECDsa(p, this.conf, ec);

          const privkey = new Share('privateKey', p.id);
          const pubkey = await mpc.keyGen(privkey);

          // Party1 reconstructs keyPair and assert on behalf of the parties.
          await mpc.p.sendShare(privkey, this.p1.id);
          if (p.id == this.p1.id) {
            const priv = new Secret('privateKey');
            for (let pId of [1, 2, 3]) {
              await p.receiveShare(priv.getShare(pId));
            }
            expectToBeReconstructable(priv);
            const pub = mpc.curve.keyFromPrivate(
              priv.value.toString(16)).getPublic();
            expect(pubkey.eq(pub)).toBeTruthy();
          }
        });
        futures.push(future);
      }

      await Promise.all(futures);
    });
  });
  describe('sign', function() {
    it('signs to message with private key shares', async function() {
      setupParties(this, 'test_ec_sign');

      const m = 'hello mpc ecdsa\n';

      const futures = [];
      for (let p of this.parties) {
        const future = background(async () => {
          const mpc = new ecdsa.MPCECDsa(p, this.conf, ec);

          // generate private key.
          const privkey = new Share('privateKey', p.id);
          const pubkey = await mpc.keyGen(privkey);

          // sign to the message.
          const sig = await mpc.sign(m, privkey, pubkey);

          // Party1 reconstructs keyPair and leave logs.
          await mpc.p.sendShare(privkey, this.p1.id);

          if (p.id == this.p1.id) {
            const priv = new Secret('privateKey');
            for (let pId of [1, 2, 3]) {
              await p.receiveShare(priv.getShare(pId));
            }
            expectToBeReconstructable(priv);
            await expectToVerify(pubkey, sig, m);
          }
        });
        futures.push(future);
      }

      await Promise.all(futures);
    });
  });
});
