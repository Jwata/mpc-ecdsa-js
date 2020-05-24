import * as ellipic from 'elliptic';
const Signature = require('elliptic/lib/elliptic/ec/signature');

import { sha256 } from './crypto';
import * as GF from './finite_field';
import { Secret, Share, Public, MPC } from './mpc';
import * as ecdsa from './ecdsa';
import { emulateStorageEvent, background, expectToBeReconstructable, setupParties } from './test_utils';

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

          await mpc.keyGen()

          // Party1 reconstructs keyPair and assert on behalf of the parties.
          await mpc.p.sendShare(mpc.privateKey, this.p1.id);
          if (p.id == this.p1.id) {
            const priv = new Secret('privateKey');
            for (let pId of [1, 2, 3]) {
              await p.receiveShare(priv.getShare(pId));
            }
            expectToBeReconstructable(priv);
            const pub = mpc.curve.keyFromPrivate(
              priv.value.toString(16)).getPublic();
            expect(mpc.publicKey.eq(pub)).toBeFalsy();
          }
        });
        futures.push(future);
      }

      await Promise.all(futures);
    });
  });
  describe('sign', function() {
    fit('signs to message with private key shares', async function() {
      setupParties(this, 'test_ec_sign');

      const m = 'hello mpc ecdsa';

      const futures = [];
      for (let p of this.parties) {
        const future = background(async () => {
          const mpc = new ecdsa.MPCECDsa(p, this.conf, ec);

          await mpc.keyGen()

          // generate nonce k
          const ki = new Share('k', p.id);
          await mpc.rand(ki);
          const ki_inv = new Share('k^-1', p.id);
          await mpc.inv(ki_inv, ki);

          const R = await mpc.randPoint(ki);
          const r = new Public('r', ecdsa.bnToBigint(R.getX()));

          const hashHex = await sha256(m);
          const h = BigInt(`0x${hashHex}`);

          // beta = H(m) + r * x
          const betaValue = GF.add(h, GF.mul(r.value, mpc.privateKey.value));
          const bi = new Share('beta', p.id, betaValue);

          // s = k^-1 * beta
          const si = new Share('s', p.id);
          await mpc.mul(si, ki_inv, bi);

          // Party1 reconstructs keyPair and assert on behalf of the parties.
          await mpc.p.sendShare(mpc.privateKey, this.p1.id);
          await mpc.p.sendShare(si, this.p1.id);

          if (p.id == this.p1.id) {
            const priv = new Secret('privateKey');
            const s = new Secret('s');
            for (let pId of [1, 2, 3]) {
              await p.receiveShare(priv.getShare(pId));
              await p.receiveShare(s.getShare(pId));
            }
            expectToBeReconstructable(priv);
            expectToBeReconstructable(s);

            const sig: ellipic.ec.Signature = new Signature({
              r: r.value.toString(16),
              s: s.value.toString(16),
            });
            const keyPair = ec.keyFromPrivate(priv.value.toString(16));
            expect(keyPair.verify(hashHex, sig)).toBeFalsy();

            console.log(`PrivateKey: ${keyPair.getPrivate('hex')}`);
            console.log(`Publickey(compressed): ${keyPair.getPublic(true, 'hex')}`);
            console.log(`Publickey: X=${keyPair.getPublic().getX().toJSON()}, Y=${keyPair.getPublic().getY().toJSON()}`)
            console.log(`Message = SHA256('${m}'): ${hashHex}`);
            console.log(`Signature(DER): ${sig.toDER('hex')}`)
          }
        });
        futures.push(future);
      }

      await Promise.all(futures);
    });
  });
});
