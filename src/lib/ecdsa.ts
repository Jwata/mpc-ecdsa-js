import * as elliptic from 'elliptic';
import * as mpclib from './mpc';

export class MPCEC {
  mpc: mpclib.MPC;
  curve: elliptic.ec;
  constructor(mpc: mpclib.MPC, curve: elliptic.ec) {
    this.mpc = mpc;
    this.curve = curve;
  }
}
