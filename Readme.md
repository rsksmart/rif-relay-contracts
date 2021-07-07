### Rif Relay Contracts

This project is part of the rif relay ecosystem, it contains all the contracts that
the rif relay system use.

#### How to deploy contracts

To deploy you can use 2 ways:

1. Configure the `truffle.js` file on the root of the project to set
your network and later run `npx truffle migrate --network <YOUR_NETWORK>`. 

2. Configure the `truffle.js` file on the root of the project to set the rsk
network and then run `npm run deploy <YOUR_NETWORK>`.

That will start the migration, at the end you should see a summary with all the 
contract addresses.

#### How to compile contracts

Just run `npx truffle compile` at the root of the project and that will compile the 
contracts and generate a folder build with all the compiled contracts inside.

#### How to generate a dist version
Run this command `npm run dist` to generate the dist folder with the distributable 
version inside.

#### How to use the contracts as library

To use this project as a dependency you can install it on your project like any
other dependency like this `npm i --save @rsksmart/rif-relay-contracts`. That will
provide you with a way to get the contracts and interfaces. You can use them
like this:

```javascript
import {RelayHub, IForwarder} from '@rsksmart/rif-relay-contracts';

const relayHubContractAbi = RelayHub.abi;
const iForwarderAbi = IForwarder.abi;
```
