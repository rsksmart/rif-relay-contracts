import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-watcher';
import '@nomiclabs/hardhat-ethers';
import { allowTokens } from './scripts/allowTokens';
import { deploy } from './scripts/deploy';
import { HardhatUserConfig, task } from 'hardhat/config';

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

task('deploy', 'Deploys rif-relay contracts to selected network')
  .setAction(async (args, hre) => {
    await deploy(hre);
  }
);

task('allow-tokens', 'allows a list of tokens')
  .addPositionalParam('tokenlist', 'list of tokens')
  .setAction(async (taskArgs: { tokenlist: string }, hre) => {
    await allowTokens(taskArgs, hre);
  }
);

export default config;