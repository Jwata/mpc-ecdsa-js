import * as sinon from 'sinon';
import * as sss from './shamir_secret_sharing';
import { Party, Secret, LocalStorageSession } from './mpc';

export function setupParties(test: jasmine.Block, session_name: string) {
  console.log('session_name', session_name);
  const session = LocalStorageSession.init(session_name);
  test.p1 = new Party(1, session);
  test.p2 = new Party(2, session);
  test.p3 = new Party(3, session);
  test.parties = [test.p1, test.p2, test.p3];
  test.dealer = new Party(999, session);
  test.conf = { n: 3, k: 2 };

  // All participants connect to the network
  test.p1.connect();
  test.p2.connect();
  test.p3.connect();
  test.dealer.connect();
}

export function emulateStorageEvent() {
  const origSetItem = window.localStorage.setItem;
  const setItemStub = sinon.stub(window.localStorage, 'setItem');
  setItemStub.callsFake((k: string, v: string) => {
    const event: StorageEventInit = {
      storageArea: localStorage,
      key: k,
      newValue: v,
      oldValue: null,
    }
    console.debug('dispatching event');
    window.dispatchEvent(new StorageEvent('storage', event))
    origSetItem.apply(window.localStorage, [k, v]);
  });

  return function cleanup() {
    setItemStub.restore && setItemStub.restore();
  };
};

export async function background(f: () => void, delay: number = 0) {
  return new Promise((resolve, _reject) => {
    const id = setInterval(() => {
      clearInterval(id);
      resolve(f());
    }, delay);
  });
};

export function expectToBeReconstructable(s: Secret, expected?: bigint) {
  const s1 = s.getShare(1).value;
  const s2 = s.getShare(2).value;
  const s3 = s.getShare(3).value;
  if (expected) {
    expect(s.reconstruct()).toEqual(expected);
  } else {
    expected = s.reconstruct();
  }
  expect(sss.reconstruct([[1n, s1], [2n, s2]])).toEqual(expected);
  expect(sss.reconstruct([[1n, s1], [3n, s3]])).toEqual(expected);
  expect(sss.reconstruct([[2n, s2], [3n, s3]])).toEqual(expected);
}
