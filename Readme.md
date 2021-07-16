## Rif Relay Contracts

This project is part of the rif relay ecosystem, it contains all the contracts that
the rif relay system use.

### Pre-Requisites

* An RSKJ Node running locally
* Node version 12.18

#### How to deploy contracts

To deploy you can use 2 ways:

1. Configure the `truffle.js` file on the root of the project to set
your network and later run `npx truffle migrate --network <YOUR_NETWORK>`. 

2. Configure the `truffle.js` file on the root of the project to set the rsk
network and then run `npm run deploy <YOUR_NETWORK>`.

That will start the migration on `<YOUR_NETWORK>`, at the end you should see a summary with all the 
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

**Note: you can't use `npm i --save @rsksmart/rif-relay-contracts` to install
this dependency since we don't have a release version at this time. A way to install it for now is to add to your dependencies on the `package.json` file this line 
`"@rsksmart/rif-relay-contracts": "https://github.com/anarancio/rif-relay-contracts",` and then run `npm i`**

#### How to add new resources

You always can add new solidity files inside the contracts folder at the root
of this repository, but you need to understand a few rules before doing that.

1. If your new file is not meant to be used outside this repository (internal contract or contract that will not be
   be manually instantiated) then you don't need to worry about anything else than just making solidity compile using
   `npm run compile` and making the linter work running `npm run lint:sol`.
   
2. If your file it's a contract that needs to be manually instantiated or referenced from
outside this project then you need to follow some steps. Basically you make your
   changes on solidity, then run `npm run compile` and `npm run lint:sol`, if everything went well then
   your next step should be going to the `index.ts` file in the root of this project
   and add those new contracts/interfaces to the import/export declarations like this.
   ```typescript
      const SomeContract = require('./build/contracts/SomeContract.json');
   
      export {
         ...,
         SomeContract
      };
   ```
   
#### How to generate a new distributable version

1. Bump the version on the `package.json` file.
2. Commit and push any changes included the bump.

#### For Github

1. Run `npm pack` to generate the tarball to be publish as release on github.
2. Generate a new release on github and upload the generated tarball.

#### For NPM

1. Run `npm login` to login to your account on npm registry.
2. Run `npm publish` to generate the distributable version for NodeJS

#### For direct use

1. Run `npm run dist` to generate the distributable version.
2. Commit and push the dist folder with the updated version to the repository on master.

#### How to allow tokens

Once you have the contracts deployed you need to allow tokens to be able to work with them
on the rif relay system, you have some commands you can use:

1. To allow a specific token you run `npm run allowTokens <TOKEN_ADDRESS>` where
`<TOKEN_ADDRESS>` is the token address you want to allow on the available verifiers.
   
2. To retrieve the allowed tokens you can run `npm run allowedTokens` and that will
prompt the tokens allowed on the console.
   
#### Contract Addresses

Each time you run `npm run deploy <NETWORK>` a json file is updated with the
new contract addresses on the root of this project, that file is called `contract-addresses.json`
and it contains all the addresses of the deployed contracts on the selected network. This file also is being
exported on the distributable version to provide the consumers a way to know the contract addresses on testnet and mainnet
when we start to deliver this as a node js dependency.

#### Contract Addresses on development

When you are working on develop and making changes to the contract and deploying 
several times the config file will be updated each time a migration is executed. 
To use these new addresses each time you make a change and keep all updated you can change the way you
import this dependency on your project, basically you need to keep this repo in the same folder
as your project and the change your package.json file to import this dependency like this 
`"@rsksmart/rif-relay-contracts": "../rif-relay-contracts",` instead of having the repository url. That
will let you have always the latest version and addresses for your contracts.

#### Husky and linters

We use husky to check linters and code styles on commits, if you commit your
changes and the commit fails on lint or prettier checks you can use these command
to check and fix the errors before trying to commit again:

* `npm run lint:ts`: to check linter bugs for typescript
* `npm run lint:ts:fix`: to fix linter bugs for typescript
* `npm run lint:sol`: to see bugs on solidity
* `npm run prettier`: to check codestyles errors
* `npm run prettier:fix`: to fix codestyles errors
