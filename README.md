# MPC ECDSA in Javascript

This is a demonstration of ECDSA distributed key generation and signing protocols in a [secure multi-party computation (MPC)](https://en.wikipedia.org/wiki/Secure_multi-party_computation)) setting. This is inspired by *Fast Secure Multiparty ECDSA with Practical Distributed Key Generation and Applications to Cryptocurrency Custody, Y. Lindell et al, 2018*. [eprint](https://eprint.iacr.org/2018/987.pdf), [CCS'18](https://dl.acm.org/doi/10.1145/3243734.3243788), but in a more relaxed security mainly for self learning MPC protocols.

## MPC Setting

**Secret Sharing**:  In this demo, [Shamir Secret Sharing(SSS)]([https://en.wikipedia.org/wiki/Shamir%27s_Secret_Sharing](https://en.wikipedia.org/wiki/Shamir's_Secret_Sharing)) is used for parties to have *shares* without revealing secret information, such as secret key of EC, nonce `k` in signing protocol. A prime field is used for polinomial computations. This is a *k-out-of-n* protocol for any *n* and *k* satisfy *n <= 2k - 1*, where *n* is the total number of parties, and *k* is the number of honest parties.

**Security**: This setting assumes *Semi-Honest* security model where all parties are expected to follow the protocols, but some of corrupted parties cooperate to reveal secret information. Therefore, it *should not* be used for real applications. If you need a *Malicious* model, please check the papers.

## Demo

TODO: update

## Protocols

ECDSA key generation / signing protocols consits of sub protocols.

### Add

TODO: update

### Multiply

TODO: update

### Power

TODO: update

### Random

TODO: update

### Invert

TODO: update

### Key Generate

TODO: update

### Sign

TODO: update

## Development

### Setup

```bash
yarn install
```

### Test

```bash
yarn run test
```

### Serve

```
yarn serve
```

This command runs a local http server, and builds asserts if there are changes on the code. Open `http://localhost:9000/demo.html` for demos.

### Build

```bash
yarn run build
```

This command generates assets under `dist` dir.  

## LICENSE

MIT License
