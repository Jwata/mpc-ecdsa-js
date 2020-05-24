import * as ellipic from 'elliptic'

import { emulateStorageEvent, background, expectToBeReconstructable, setupParties } from './test_utils';
import * as GF from './finite_field';
import { Secret, Share, MPC } from './mpc';
import * as ecdsa from './ecdsa';

// elliptic curve
const ec = new ellipic.ec('secp256k1');

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

fdescribe('MPCEC', function() {
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

      for (let p of this.parties) {
        background(async () => {
          const mpc = new ecdsa.MPCECDsa(p, this.conf, ec);

          await mpc.keyGen()

          // Party1 reconstructs keyPair on behalf of the parties.
          await mpc.p.sendShare(mpc.privateKey, this.p1.id);
          if (p != this.p1) return;

          const priv = new Secret('privateKey');
          for (let pId of [1, 2, 3]) {
            await p.receiveShare(priv.getShare(pId));
          }
          expectToBeReconstructable(priv);
          const pub = mpc.curve.keyFromPrivate(
            priv.value.toString(16)).getPublic();
          expect(mpc.publicKey.eq(pub)).toBeTruthy();
        });
      }
    });
  });
  describe('sign', function() {
    it('signs to message with private key shares', async function() {
      setupParties(this, 'test_ec_sign');

      for (let p of this.parties) {
        background(async () => {
          const mpc = new ecdsa.MPCECDsa(p, this.conf, ec);

          await mpc.keyGen()

          // Party1 reconstructs keyPair on behalf of the parties.
          await mpc.p.sendShare(mpc.privateKey, this.p1.id);
          if (p != this.p1) return;

          const priv = new Secret('privateKey');
          for (let pId of [1, 2, 3]) {
            await p.receiveShare(priv.getShare(pId));
          }
          expectToBeReconstructable(priv);
          const pub = mpc.curve.keyFromPrivate(
            priv.value.toString(16)).getPublic();
          expect(mpc.publicKey.eq(pub)).toBeTruthy();
        });
      }
    });
  });
});
