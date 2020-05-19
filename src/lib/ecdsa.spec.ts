import * as ellipic from 'elliptic'

import * as ecdsa from './ecdsa';
import { Secret, Share, Party, LocalStorageSession, MPC } from './mpc';
import { emulateStorageEvent, background, expectToBeReconstructable } from './test_utils';

describe('MPCEC', function() {
  let stubCleanup: Function;
  beforeAll(function() {
    stubCleanup = emulateStorageEvent();
  });
  afterAll(function() {
    stubCleanup();
  });
  it('generates secret key destributedly', async function() {
    const session = LocalStorageSession.init('test_ec_keygen');
    const p1 = new Party(1, session);
    const p2 = new Party(2, session);
    const p3 = new Party(3, session);
    const dealer = new Party(999, session);
    const conf = { n: 3, k: 2 };

    // All participants connect to the network
    p1.connect();
    p2.connect();
    p3.connect();
    dealer.connect();

    // elliptic curve
    const ec = new ellipic.ec('secp256k1');

    // Party
    for (let p of [p1, p2, p3]) {
      background(async () => {
        const mpc = new MPC(p, conf);

        // generate priv key shares
        const priv = new Share('priv', p.id);
        await mpc.rand(priv);

        // calcluate Pub = priv * G locally
        const privHex = priv.value.toString(16);
        const keyPair = ec.keyFromPrivate(privHex, 'hex');
        expect(keyPair.getPrivate('hex')).toEqual(privHex);

        const pub = keyPair.getPublic();
        const x = pub.getX().toJSON()
        const pubX = new Share('pubX', p.id, `0x${x}`);
        const y = pub.getY().toJSON()
        const pubY = new Share('pubY', p.id, `0x${y}`);

        await mpc.p.sendShare(priv, dealer.id);
        await mpc.p.sendShare(pubX, dealer.id);
        await mpc.p.sendShare(pubY, dealer.id);
      });
    }

    // Dealer
    await background(async () => {
      const priv = new Secret('priv');
      const pubX = new Secret('pubX');
      const pubY = new Secret('pubY');

      // recieve result shares from parties
      const points: Array<[number, ecdsa.ECPoint]> = [];
      for (let pId of [1, 2, 3]) {
        await dealer.receiveShare(priv.getShare(pId));
        await dealer.receiveShare(pubX.getShare(pId));
        await dealer.receiveShare(pubY.getShare(pId));
        const P = ec.keyFromPublic({
          x: pubX.getShare(pId).value.toString(16),
          y: pubY.getShare(pId).value.toString(16)
        }).getPublic();
        points.push([pId, P]);
      }
      const pubFromShares = ecdsa.reconstruct(points);

      expectToBeReconstructable(priv);
      const pubExpected = ec.keyFromPrivate(priv.value.toString(16), 'hex').getPublic();

      expect(pubExpected.eq(pubFromShares)).toBeTrue();
    });
  });
});
