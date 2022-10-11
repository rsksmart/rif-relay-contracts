# RIF Relay Contracts

This project is part of the RIF Relay ecosystem. It contains all the smart contracts that the system uses.

## Table of Contents

- [**Installation**](#installation)
  - [**Pre-requisites**](#pre-requisites)
  - [**Dependencies**](#dependencies)
- [**Smart Contracts**](#smart-contracts)
  - [**Deployment**](#deployment)
  - [**Addresses**](#addresses)
- [**System usage**](#system-usage)
  - [**Allowing tokens**](#allowing-tokens)
  - [**TestToken Minting**](#testtoken-minting)
- [**Library usage**](#library-usage)
  - [**As a dependency**](#as-a-dependency)
  - [**Development**](#development)
    - [**Adding new files**](#adding-new-files)
    - [**Contract addresses**](#contract-addresses)
    - [**Husky and linters**](#husky-and-linters)
    - [**Generating a new distributable version**](#generating-a-new-distributable-version)
      - [**For GitHub**](#for-github) 
      - [**For NPM**](#for-npm)
      - [**For direct use (no publishing)**](#for-direct-use-no-publishing)

## Installation

### Pre-requisites

- An RSKJ Node running locally
- Node version 12.18

### Dependencies

Install all dependencies by running `npm install`.

The project is ready to be used at this point.

## Smart Contracts

### Deployment

The contracts can be deployed in the following way:

1. Configure the `hardhat.config.ts` file on the root of the project to set your network 
2. Run `npm run deploy --network <NETWORK_NAME>` 

This will start the migration on `<NETWORK_NAME>`; at the end of it you should see a summary with all the contract addresses.

### Addresses

Each time the smart contracts are deployed, the `contract-addresses.json` file is updated. This file contains all contracts addresses for the network they were selected to be deployed on. 

This change can be committed so that this repository is updated with the new version of the file; addresses for Testnet and Mainnet should be kept up to date.

This file also is being exported on the distributable version to provide the consumers a way to know the contract addresses on Testnet and Mainnet when we begin to release the project as a Node.js dependency.

## System usage 

### Allowing tokens

Once the smart contracts are deployed, tokens must be individually allowed to be able to work with the RIF Relay system. There are some helpful commands for this:

1. To allow a specific token, run `npm run allow-tokens <NETWORK_NAME> <TOKEN_ADDRESSES>` where:
    - `<TOKEN_ADDRESSES>` is a comma-separated list of the token addresses to be allowed on the available verifiers
    - `<NETWORK_NAME>` is an optional parameter for the network name, taken from the `truffle.js` file (default value is `regtest`) **important! This should be the same network name as the one used to deploy the contracts** 
2. To query allowed tokens run `npm run allowedTokens <NETWORK_NAME>`. This will display them on the console.

### TestToken Minting

Once the smart contracts are deployed, [TestToken](./contracts/test/tokens/TestToken.sol)s can be minted and transferred by using the related script:
```bash
npx truffle exec --network <network_name> tasks/mint.js --tokenReceiver <0xabc123> --amount <amount_in_wei>
```
Parameters:
- `tokenReceiver`: the address of the account the token will be transferred to (default value - `(await web3.eth.getAccounts())[0]`)
- `amount`: the amount of tokens that will be minted and transferred (default value - `web3.utils.toWei('1', 'ether');`).

#### Warning message
Truffle doesn’t support additional arguments natively when running `truffle exec` command, so the user can ignore the warning shown when the command is executed.

```bash
Warning: possible unsupported (undocumented in help) command line option(s): --tokenReceiver,--amount
```

For further info about `truffle exec`, please have a look at its [official documentation](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#exec).

## Library usage

### As a dependency

You can install this project like any other dependency through: 

```bash
npm i --save @rsksmart/rif-relay-contracts
```

which will provide you with a way to use the contracts and interfaces, e.g.:

```javascript
import {RelayHub, IForwarder} from '@rsksmart/rif-relay-contracts';

const relayHubContractAbi = RelayHub.abi;
const iForwarderAbi = IForwarder.abi;
```

### Development

#### Adding new files

New solidity files can be added inside the contracts folder at the root of this repository, but note that:

1. If your new file is not meant to be used outside this repository (internal contract or contract that will not be manually instantiated) then you don’t need to worry about anything else than just making solidity compile using `npm run compile` and making the linter work running `npm run lint:sol`.  
2. If your file is a contract that needs to be manually instantiated or referenced from outside this project, you’ll also need to run `npm run compile` and `npm run lint:sol`. If everything goes well, go to the `index.ts` file at the root of this project and add those new contracts/interfaces to the import/export declarations:
```typescript
const SomeContract = require('./build/contracts/SomeContract.json');

export {
   ...,
   SomeContract
};
```

### Testing

Testing is done using hardhat (mocha), chai, chai-as-promised, hardhat-chai-matchers, and smock for faking and mocking.

* `npm run test`: to run the test suite
* `npm run tdd`: to run the testsuite in watch-mode for faster TDD
* `npm run ci:test`: to compile and run test 

### Contract addresses

During development, the smart contract addresses config file can be expected to be updated each time a migration is executed. 

To automatically use these new addresses each time a change is made, use the `npm link` mechanism (https://docs.npmjs.com/cli/v8/commands/npm-link).

### Husky and linters

We use Husky to check linters and code style for every commit. If commiting changes fails on lint or prettier checks you can use these commands to check and fix the errors before trying again:

* `npm run lint`:  to check/fix all linter bugs
* `npm run lint:ts`: to check/fix linter bugs for typescript
* `npm run lint:sol`: to check/fix linter bugs for solidity
* `npm run format`: to check/fix all code style errors
* `npm run format:ts`: to check/fix code style errors for typescript
* `npm run format`: to check/fix code style errors for solidity
* `npm run ci:lint`: to check all linter bugs
* `npm run ci:format`: to check all code style errors

### Deploy to network

1. Modify deployment scripts if needed
2. Add configuration for your network
3. Run `npm run deploy` to run deployment scripts

### Generating a new distributable version

1. Run the `npm run compile` command to delete all generated folders and recompile
2. Bump the version on the `package.json` file (not strictly needed).
3. Commit and push any changes, including the version bump.

### For GitHub

1. Create a new tag with the new version (from `package.json`) and github actions will update npm 

### For NPM

1. Run `npm login` to login to your account on npm registry.
2. Run `npm publish` to generate the distributable version for NodeJS.

### For direct use (no publishing)

No extra steps are needed beyond generating the `dist` folder and merging it to `master`.
