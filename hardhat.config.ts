import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import dotenv from 'dotenv';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-watcher';
import { HardhatUserConfig, task } from 'hardhat/config';
import { HttpNetworkUserConfig } from 'hardhat/types';
import { mint, MintArgs } from './tasks/mint';
import { allowTokens } from './tasks/allowTokens';
import {
  changePartnerShares,
  ChangePartnerSharesArg,
} from './tasks/changePartnerShares';
import { deploy } from './tasks/deploy';
import { deployCollector, DeployCollectorArg } from './tasks/deployCollector';
import { getAllowedTokens } from './tasks/getAllowedTokens';
import { removeTokens } from './tasks/removeTokens';
import { withdraw, WithdrawSharesArg } from './tasks/withdraw';
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
        // 'clean',
        // { command: 'compile', params: { quiet: true } },
        {
          command: 'test',
          params: {
            noCompile: true,
            testFiles: ['{path}'],
          },
        },
      ],
      files: ['./test/**/*.ts'],
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

task('deploy', 'Deploys rif-relay contracts to selected network').setAction(
  async (_, hre) => {
    await deploy(hre);
  }
);

task('collector:deploy', 'Deploys the collector')
  .addOptionalParam('configFileName', 'Path of the collector config file')
  .addOptionalParam('outputFileName', 'Path of the output file')
  .setAction(async (taskArgs: DeployCollectorArg, hre) => {
    await deployCollector(taskArgs, hre);
  });

task('allow-tokens', 'Allows a list of tokens')
  .addPositionalParam('tokenlist', 'list of tokens')
  .setAction(async (taskArgs: { tokenlist: string }, hre) => {
    await allowTokens(taskArgs, hre);
  });

task('allowed-tokens', 'Retrieves a list of allowed tokens').setAction(
  async (_, hre) => {
    await getAllowedTokens(hre);
  }
);

task('collector:withdraw', 'Withdraws funds from a collector contract')
  .addParam(
    'collectorAddress',
    'address of the collector we want to withdraw from'
  )
  .addParam(
    'partnerConfig',
    'path of the file that includes the partner shares configuration'
  )
  .addOptionalParam('gasLimit', 'gasLimit to be used for the transaction')
  .setAction(async (taskArgs: WithdrawSharesArg, hre) => {
    await withdraw(taskArgs, hre);
  });

task('remove-tokens', 'Removes a list of tokens')
  .addPositionalParam('tokenlist', 'list of tokens')
  .setAction(async (taskArgs: { tokenlist: string }, hre) => {
    await removeTokens(taskArgs, hre);
  });

task('collector:change-partners', 'Change collector partners')
  .addParam('collectorAddress', 'address of the collector we want to modify')
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
