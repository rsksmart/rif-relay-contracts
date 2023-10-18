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
  - [**Managing tokens**](#managing-tokens)
  - [**UtilToken Minting**](#UtilToken-minting)
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
2. Run `npx hardhat deploy --network <NETWORK_NAME>` 

This will start the migration on `<NETWORK_NAME>`; at the end of it you should see a summary with all the contract addresses.

To use a specific account to deploy the contracts, we could either set the private key (PK) or the mnemonic (MNEMONIC) as env variables.

```shell
MNEMONIC='MNEMONIC WORDS HERE' npx hardhat deploy --network <NETWORK_NAME>
// or
PK='PRIVATE_KEY_HERE_WITHOUT_0X' npx hardhat deploy --network <NETWORK_NAME>
```

#### Collector Deployment

To deploy a collector, we need to the script `collector:deploy`. It receives the following parameters:
- `config-file-name`: optional, used to specify the collector owner and the partners configuration (addresses and shares). If not specified, the file `deploy-collector.input.json` will be used. Please have a look at `deploy-collector.input.sample.json` for a sample file.
- `outputFile`: optional, used to log the main information of the collector deployment. If not specified, the file `revenue-sharing-addresses.json` will be used. 

Usage:
```bash
npx hardhat collector:deploy --network "<network>" --config-file-name "<input_config_file.json>" --output-file-name "output_config_file.json"
```

Example:
```bash
npx hardhat collector:deploy --network regtest --config-file-name "deploy-collector.input.json" --output-file-name "collector-output.json"
```

#### Change partner shares

Pre-requirements:
- the collector we want to change must be deployed. See the [related section](#collector-deployment) to deploy a collector;
- there must be no shares to be distributed among the partners otherwise the transaction will fail; please be sure that the current balance is less than or equal to the number of partners;
- only the owner can execute this transaction.

The `collector:change-partners` is a utility script that can be run to change the partner shares of a collector already deployed. It receives the following parameters:
- `collector-address`: mandatory, it's the address of the collector we want to change;
- `partner-config`: it includes the new partner shares we want to set;
- `gas-limit`: optional, it's the gas limit used for the transaction. If the transaction fails, we may probably need to specify an higher value; default value is `150000`;

Usage:
```bash
npx hardhat collector:change-partners --collector-address "<collector_address>" --partner-config "<file_including_partners_config.json>" --gas-limit "<gas_limit>" --network regtest
```
Example:
```bash
npx hardhat collector:change-partners --collector-address "0x9b91c655AaE10E6cd0a941Aa90A6e7aa97FB02F4" --partner-config "partner-shares.json" --gas-limit "200000" --network regtest
```

#### Add collector token

Pre-requirements:
- the collector we want to change must be deployed. See the [related section](#collector-deployment) to deploy a collector.

Usage:

```bash
npx hardhat collector:addToken --collector-address "<collector_address>" --token-address "<token_address>" --network regtest
```

Example:
```bash
npx hardhat collector:addToken --collector-address "0xeFb80DB9E2d943A492Bd988f4c619495cA815643" --token-address "0xfD1dda8C3BC734Bc1C8e71F69F25BFBEe9cE9535" --network regtest
```

#### Get collector tokens

Pre-requirements:
- the collector we want to change must be deployed. See the [related section](#collector-deployment) to deploy a collector.

Usage:

```bash
npx hardhat collector:getTokens --collector-address "<collector_address>" --network regtest
```

Example:
```bash
npx hardhat collector:getTokens --collector-address "0xeFb80DB9E2d943A492Bd988f4c619495cA815643" --network regtest
```

#### Remove collector token

Pre-requirements:
- the collector we want to change must be deployed. See the [related section](#collector-deployment) to deploy a collector;
- the token that we want to remove should have no balance for the collector we're modifying;

Usage:

```bash
npx hardhat collector:removeToken --collector-address "<collector_address>" --token-address "<token_address>" --network regtest
```

Example:
```bash
npx hardhat collector:removeToken --collector-address "0xeFb80DB9E2d943A492Bd988f4c619495cA815643" --token-address "0x39B12C05E8503356E3a7DF0B7B33efA4c054C409" --network regtest   
```

### Addresses

Each time the smart contracts are deployed, the `contract-addresses.json` file is updated. This file contains all contracts addresses for the network they were selected to be deployed on. 

This change can be committed so that this repository is updated with the new version of the file; addresses for Testnet and Mainnet should be kept up to date.

This file also is being exported on the distributable version to provide the consumers a way to know the contract addresses on Testnet and Mainnet when we begin to release the project as a Node.js dependency.

## System usage 

### Managing tokens

Once the smart contracts are deployed, tokens must be individually allowed to be able to work with the RIF Relay system. In the same way, tokens can be removed from the list of previously allowed tokens. There are some helpful commands for this:

1. To allow a specific token, run `npx hardhat allow-tokens --network <NETWORK_NAME> --token-list <TOKEN_ADDRESSES>` where:
    - `<TOKEN_ADDRESSES>` is a comma-separated list of the token addresses to be allowed on the available verifiers
    - `<NETWORK_NAME>` is an optional parameter for the network name, taken from the `hardhat.config.ts` file (default value is `hardhat`) **important! This should be the same network name as the one used to deploy the contracts** 
If you want to modify just one or few verifiers, please specify it with the argument `--verifier-list` in a comma-separated format: `npx hardhat allow-tokens --network <NETWORK_NAME> --token-list <TOKEN_ADDRESSES> --verifier-list <address1,address2>`
2. To query allowed tokens run `npx hardhat allowed-tokens --network <NETWORK_NAME>`. This will display them on the console. If you want to query just one or few verifiers, please specify it with the argument `--verifier-list` in a comma-separated format: `npx hardhat allowed-tokens --network <NETWORK_NAME> --verifier-list <address1,address2>`
3. To remove a specific token, run `npx hardhat remove-tokens --network <NETWORK_NAME> --token-list <TOKEN_ADDRESSES>` where:
    - `<TOKEN_ADDRESSES>` is a comma-separated list of the token addresses to be removed on the available verifiers.
    - `<NETWORK_NAME>` is an optional parameter for the network name, taken from the `hardhat.config.ts` file (default value is `hardhat`) **important! This should be the same network name as the one used to deploy the contracts**.
If you want to modify just one or few verifiers, please specify it with the argument `--verifier-list` in a comma-separated format: `npx hardhat remove-tokens --network <NETWORK_NAME> --token-list <TOKEN_ADDRESSES> --verifier-list <address1,address2>`

### UtilToken Minting

Once the smart contracts are deployed, [UtilToken](./contracts/utils/UtilToken.sol)s can be minted and transferred by using the related script:
```bash
npx hardhat mint --token-address <0xabc123> --amount <amount_in_wei> --receiver <0xabc123> --network <NETWORK_NAME> 
```
Parameters:
- `token-address`: the address of the token that will be minted. The ERC20 token that will be used, needs to have a mint function. 
- `amount`: the amount of tokens that will be minted and transferred.
- `receiver`: the address of the account the token will be transferred to.

#### Warning message
Truffle doesn’t support additional arguments natively when running `truffle exec` command, so the user can ignore the warning shown when the command is executed.

```bash
Warning: possible unsupported (undocumented in help) command line option(s): --tokenReceiver,--amount
```

For further info about `truffle exec`, please have a look at its [official documentation](https://www.trufflesuite.com/docs/truffle/reference/truffle-commands#exec).

### Withdraw

To withdraw (share) the funds from the Collector contract, the repository provides the utility script `collector:withdraw`. It allows the user to call either the `withdraw()` or `withdrawToken()` function from the Collector contract. It receives the following parameters:

- `collector-address`: Mandatory. It's the address of the collector;
- `token-address`: Optional. It's the address of the token contract to withdraw. If provided, the function `withdrawToken()` will be called with this specific value, otherwise the function `withdraw()` will be called and the withdraw will be executed on all the allowed tokens;
- `gas-limit`: Optional. It's the gas limit used for the transaction. Default value is `200000`;

```bash
npx hardhat collector:withdraw --collector-address '<0xcollector_address>' --token-address '<0xtoken_address>'  --gas-limit <gas_limit> --network <network-name>
```

Example:
```bash
npx hardhat collector:withdraw --collector-address "0x0Aa058aD63E36bC2f98806f2D638353AE89C3634" --token-address "0x6f217dEd6c86A57f1211F464302e6fA544045B4f" --gas-limit 500000 --network regtest 
```

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
3. Run `npx hardhat deploy --network <NETWORK>` to run deployment scripts

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
