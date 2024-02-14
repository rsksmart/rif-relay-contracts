import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import dotenv from 'dotenv';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-watcher';
import { HardhatUserConfig, task } from 'hardhat/config';
import { HttpNetworkUserConfig } from 'hardhat/types';
import { mint, MintArgs } from './tasks/mint';
import { AllowedTokensArgs, allowTokens } from './tasks/allowTokens';
import {
  changePartnerShares,
  ChangePartnerSharesArg,
} from './tasks/changePartnerShares';
import { DeployArg, deploy } from './tasks/deploy';
import {
  deployCollector,
  DeployCollectorArg,
} from './tasks/collector/deployCollector';
import {
  GetAllowedTokensArgs,
  getAllowedTokens,
} from './tasks/getAllowedTokens';
import { removeTokens } from './tasks/removeTokens';
import { withdraw, WithdrawSharesArg } from './tasks/withdraw';
import {
  addTokenToCollector,
  ManageCollectorTokenArgs,
} from './tasks/collector/addToken';
import {
  getCollectorTokens,
  GetCollectorTokensArgs,
} from './tasks/collector/getTokens';
import { removeTokenFromCollector } from './tasks/collector/removeToken';
dotenv.config();

const DEFAULT_MNEMONIC =
  'stuff slice staff easily soup parent arm payment cotton trade scatter struggle';
const { PK, MNEMONIC } = process.env;
const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          outputSelection: {
            '*': {
              '*': ['storageLayout'],
            },
          },
        },
      },
    ],
  },
  networks: {
    regtest: {
      url: 'http://localhost:4444',
      chainId: 33,
    },
    testnet: {
      ...sharedNetworkConfig,
      url: 'https://public-node.testnet.rsk.co',
      chainId: 31,
    },
    mainnet: {
      ...sharedNetworkConfig,
      url: 'https://public-node.rsk.co',
      chainId: 30,
    },
  },
  typechain: {
    target: 'ethers-v5',
    outDir: 'typechain-types',
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false,
  },
  watcher: {
    compilation: {
      tasks: ['compile'],
      files: ['./contracts'],
      verbose: true,
    },
    tdd: {
      tasks: [
        'clean',
        { command: 'compile', params: { quiet: true } },
        {
          command: 'test',
          params: {
            noCompile: true,
            testFiles: ['{path}'],
          },
        },
      ],
      files: ['./contracts/*.sol', './test/**/*.ts', './tasks/**/*.ts'],
      verbose: true,
      clearOnStart: true,
    },
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
  },
  mocha: {
    timeout: 20000,
  },
};

task(
  'deploy',
  'Deploys rif-relay contracts to selected network. If no flags are specified, all contracts will be deployed'
)
  .addFlag(
    'relayHub',
    'If specified, it will deploy the relayHub and the penalizer'
  )
  .addFlag(
    'defaultSmartWallet',
    'If specified, it will deploy the default smart wallet with the factory and the verifiers (deploy, relay)'
  )
  .addFlag(
    'customSmartWallet',
    'If specified, it will deploy the custom smart wallet with the factory and the verifiers (deploy, relay)'
  )
  .addFlag(
    'nativeHoldeSmartWallet',
    'If specified, it will deploy the native holder smart wallet with the factory and the verifiers (deploy, relay)'
  )
  .addFlag(
    'utilToken',
    'If specified, it will deploy an ERC20 token to be used for testing purposes; it does not deploy the token on mainnet'
  )
  .setAction(async (taskArgs: DeployArg, hre) => {
    await deploy(taskArgs, hre);
  });

task('collector:deploy', 'Deploys the collector')
  .addOptionalParam('configFileName', 'Path of the collector config file')
  .addOptionalParam('outputFileName', 'Path of the output file')
  .setAction(async (taskArgs: DeployCollectorArg, hre) => {
    await deployCollector(taskArgs, hre);
  });

task('allow-tokens', 'Allows a list of tokens')
  .addParam('tokenList', 'list of tokens')
  .addOptionalParam(
    'verifierList',
    'list of tokens in a comma-separated format (e.g.: "address1,address2")'
  )
  .setAction(async (taskArgs: AllowedTokensArgs, hre) => {
    await allowTokens(taskArgs, hre);
  });

task('allowed-tokens', 'Retrieves a list of allowed tokens')
  .addOptionalParam(
    'verifierList',
    'list of tokens in a comma-separated format (e.g.: "address1,address2")'
  )
  .setAction(async (taskArgs: GetAllowedTokensArgs, hre) => {
    await getAllowedTokens(taskArgs, hre);
  });

task('remove-tokens', 'Removes a list of tokens')
  .addParam('tokenList', 'list of tokens')
  .addOptionalParam(
    'verifierList',
    'list of tokens in a comma-separated format (e.g.: "address1,address2")'
  )
  .setAction(async (taskArgs: AllowedTokensArgs, hre) => {
    await removeTokens(taskArgs, hre);
  });

task('collector:withdraw', 'Withdraws funds from a collector contract')
  .addParam(
    'collectorAddress',
    'address of the collector we want to withdraw from'
  )
  .addOptionalParam(
    'tokenAddress',
    'Token to withdraw. If undefined, all tokens will be withdrawn'
  )
  .addOptionalParam('gasLimit', 'gasLimit to be used for the transaction')
  .setAction(async (taskArgs: WithdrawSharesArg, hre) => {
    await withdraw(taskArgs, hre);
  });

task(
  'collector:addToken',
  'Allow the collector to receive payments in additional tokens'
)
  .addParam('collectorAddress', 'address of the collector contract to modify')
  .addParam(
    'tokenAddress',
    'address of the token we want to allow in the collector'
  )
  .setAction(async (taskArgs: ManageCollectorTokenArgs, hre) => {
    await addTokenToCollector(taskArgs, hre);
  });

task('collector:getTokens', 'Retrieve tokens managed by the collector')
  .addParam('collectorAddress', 'address of the collector contract to modify')
  .setAction(async (taskArgs: GetCollectorTokensArgs, hre) => {
    await getCollectorTokens(taskArgs, hre);
  });

task(
  'collector:removeToken',
  'Remove a token from the ones that the collector can accept to receive payments'
)
  .addParam('collectorAddress', 'address of the collector contract to modify')
  .addParam(
    'tokenAddress',
    'address of the token we want to remove in the collector'
  )
  .setAction(async (taskArgs: ManageCollectorTokenArgs, hre) => {
    await removeTokenFromCollector(taskArgs, hre);
  });

task('collector:change-partners', 'Change collector partners')
  .addParam('collectorAddress', 'address of the collector contract to modify')
  .addParam(
    'partnerConfig',
    'path of the file that includes the partner shares configuration'
  )
  .addOptionalParam('gasLimit', 'gasLimit to be used for the transaction')
  .setAction(async (taskArgs: ChangePartnerSharesArg, hre) => {
    await changePartnerShares(taskArgs, hre);
  });

task('mint', 'Mint some tokens')
  .addParam('tokenAddress', 'address of the token we want to mint')
  .addParam('amount', 'amount of tokens we want to mint')
  .addParam('receiver', 'the address that will receive the minted tokens')
  .setAction(async (taskArgs: MintArgs, hre) => {
    await mint(taskArgs, hre);
  });

export default config;
