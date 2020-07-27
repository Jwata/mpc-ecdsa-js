# How to use demo page

This page explains how to use [the demo page](https://jwata.github.io/mpc-ecdsa/demo.html) to intereact with the MPC protocols.



## UI and Query Parameters

### Displayed information

* `Settings` section shows the MPC settings.
  * `Party` ... the party ID.
  * `N` ... The total number of the parties.
  * `K` ... The number of the parties required to execute the protocols. (The threshold)
* `Outputs`  section shows the outputs of the computation.
* `Variables` sections shows the variables used in the computation.
  * `Secret` ... A secret consists of the secret value and the share values.
  * `Share` ... A share has only its value.
  * `name` ... Each variable has an identical name to send/recieve the shares between the parties.

### Query Parameter

* `party` ... The party ID. e.g. 1, 2, 3
  * 999 is a special party ID for `dealer`, who is considered as a `trusted` oracle.
* `n` ... The total number of the parties.
* `k` ... The number of the parties required to execute the protocols. (The threshold)

<img src="/Users/junji/Library/Application Support/typora-user-images/image-20200727092149492.png" alt="image-20200727092149492"/>

## Console

You can execute the MPC protcols on [the browser's dev console](https://developers.google.com/web/tools/chrome-devtools/console). The MPC APIs are implemented in [src/lib/mpc.ts](https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/lib/mpc.ts).

### Declare variables

You can declare variables using `mpclib.Secret` or `mpclib.Share`. Those are custom objects used to compute the MPC protocols.

```javascript
> var a = new mpclib.Secret('a', 1n) // name, value
> var b = new mpclib.Share('b', 1, 1n) // name, index, value(optional)
```

### Split secret to shares

You can split a secret to shares using `mpc.split()` utility. 

```javascript
> var a = new mpclib.Secret('a', 1n)
> mpc.split(a)
{1: Share, 2: Share, 3: Share}
1: Share {name: "a", _value: 91865845167068762850556508694245596620780631325926832617954365679632411730268n, index: 1}
2: Share {name: "a", _value: 183731690334137525701113017388491193241561262651853665235908731359264823460535n, index: 2}
3: Share {name: "a", _value: 275597535501206288551669526082736789862341893977780497853863097038897235190802n, index: 3}

> a.getShare(1) // or a.shares[1]
Share {name: "a", _value: 91865845167068762850556508694245596620780631325926832617954365679632411730268n, index: 1}
```

### Send share to another party

You can send a share to another party using `mpc.sendShare()` utility. And the reciever can recieve the share by using `mpc.recieveShare()`

```javascript
// On the Party1's console.
> var a = new mpclib.Share('a', 2, 1n)
> mpc.sendShare(a, 2) // share, peer ID
```

```javascript
// On the Party2's console.
> var a = new mpclib.Share('a', 2) // no need to set value.
> mpc.recieveShare(a) 
> a
Share {name: "a", index: 2, _value: 1n}
```

### Arithmetic APIs

On top of the basic protocols above, arithmetic APIs `add`, `mul`, `pow`, `rand`, `inv` are implemented. The detailed protocols are explained in [the protocols page](./protocols.md). Please refer [the demos](https://github.com/Jwata/mpc-ecdsa-js/tree/master/src/demos) to see how to use them.

### ECDSA APIs

On top of the basic and the arithmetics protocols above, ECDSA `keyGen` and `sign` are implemented. The detailed protcols are explained in [the protocols page](./protocols.md). Please refer [the ECDSA demo](https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/ecdsa.ts) to see how to use them.

## Demos

### Addition

https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/add.ts

Steps

* The dealer initializes secrets `a` and `b`.
* The dealer splits secrets `a` and `b` to shares.
* The dealer sends the shares to the parties.
* Each party recieves the shares of `a` and `b`.
* Each party computes `c = a + b` using `mpc.add()`.
  * This is a local compuation.
* Each party sends the result `c` to the dealer.
* The dealer receives the shares of `c ` from the parties.
* The dealer reconstructs `c`.

### Multiplication

https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/mul.ts

Steps

* The dealer initializes secrets `a` and `b`.
* The dealer splits secrets `a` and `b` to shares.
* The dealer sends the shares to the parties.
* Each party recieves the shares of `a` and `b`.
* Each party computes `c = a * b` using `mpc.mul()`.
  * This step involves comunications between parties.
* Each party sends the result `c` to the dealer.
* The dealer receives the shares of `c ` from the parties.
* The dealer reconstructs `c`.

### Power

https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/pow.ts)

Steps

* The dealer initializes secrets `x`.
* The dealer splits secrets `x` to shares.
* The dealer sends the shares to the parties.
* Each party recieves the share of `x`.
* Each party computes `z = x^k` using `mpc.pow()`.
  * This step involves comunications between parties.
* Each party sends the result `z` to the dealer.
* The dealer receives the shares of `z ` from the parties.
* The dealer reconstructs `z`.

### Inversion

https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/inv.ts

Steps

* The dealer initializes secrets `a`.
* The dealer splits secrets `a` to shares.
* The dealer sends the shares to the parties.
* Each party recieves the share of `a`.
* Each party computes `a_inv = a^-1` using `mpc.inv()`.
  * This step involves comunications between parties.
* Each party sends the result `a_inv` to the dealer.
* The dealer receives the shares of `a_inv ` from the parties.
* The dealer reconstructs `a_inv`.

### ECDSA

https://github.com/Jwata/mpc-ecdsa-js/blob/master/src/demos/ecdsa.ts

Steps

* The parties generate a secret key using `mpc.keyGen()`.
* The parties receive the public key and the shares of the generated secret key as the output of the `mpc.keyGen()`.
* The parties sign to a message `hello mpc ecdsa\n` using `mpc.sign()` and the output of `mpc.keyGen()`.
* As outputs, the parties have, `publib key`, `signature` and the share of `secret key`.

Notes

* This demos involves all parties now. But it could be done only with `k` parties.