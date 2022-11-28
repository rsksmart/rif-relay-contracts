import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import dotenv from 'dotenv';
import { Wallet } from 'ethers';
import 'hardhat-contract-sizer';
import 'hardhat-docgen';
import 'hardhat-watcher';
import { extendEnvironment, HardhatUserConfig, task } from 'hardhat/config';
import {
  HardhatNetworkHDAccountsUserConfig,
  HardhatRuntimeEnvironment,
  HttpNetworkAccountsConfig,
  HttpNetworkHDAccountsConfig
} from 'hardhat/types';
import { allowTokens } from './tasks/allowTokens';
import {
  changePartnerShares,
  ChangePartnerSharesArg
} from './tasks/changePartnerShares';
import { deploy } from './tasks/deploy';
import { deployCollector, DeployCollectorArg } from './tasks/deployCollector';
import { getAllowedTokens } from './tasks/getAllowedTokens';
import { removeTokens } from './tasks/removeTokens';
import { withdraw, WithdrawSharesArg } from './tasks/withdraw';
dotenv.config();

const RSK_MAINNET_COIN_TYPE = 137;
const RSK_TESTNET_COIN_TYPE = 37310;

const getDefaultNetworkCoinType = ({
  network: { name: networkName },
}: HardhatRuntimeEnvironment) => {
  if (networkName == 'hardhat') return 60;
  if (networkName == 'mainnet') return RSK_MAINNET_COIN_TYPE;
  if (networkName == 'testnet') return RSK_TESTNET_COIN_TYPE;
  if (['local', 'regtest'].includes(networkName)) return RSK_TESTNET_COIN_TYPE; // FIXME: what is the correct value here?
  juraj - check rif wallet code?

  return '';
};

extendEnvironment((hre: HardhatRuntimeEnvironment) => {
  // const hdAccount = JSON.parse(
  //   process.env['HDACCOUNT'] || ''
  // ) as HttpNetworkHDAccountsConfig;
  // if (hdAccount) {
  //   hre.network.config.accounts = hdAccount;

  //   return;
  // }
  const mnemonic = process.env['MNEMONIC'];
  if (mnemonic) {
    const passphrase = process.env['PASSPHRASE'] ?? '';
    const networkCoinType =
      process.env['COIN_TYPE'] || getDefaultNetworkCoinType(hre);

    const w = Wallet.fromMnemonic(mnemonic);
    console.log(`🦇 wallet`, w.privateKey);

    hre.network.config.accounts = {
      ...(hre.network.config.accounts as HardhatNetworkHDAccountsUserConfig),
      mnemonic,
      passphrase,
      path: `m/44'/${networkCoinType}'/0'/0`,
    } as HttpNetworkHDAccountsConfig;

    return;
  }

  const privateKeys = JSON.parse(
    process.env['PRIVATE_KEYS'] || ''
  ) as HttpNetworkAccountsConfig;

  console.log(`🦇 privateKeys`, privateKeys);

  if (Array.isArray(privateKeys) && privateKeys.length) {
    privateKeys.forEach((acc) => new Wallet(acc));
  }
  hre.network.config.accounts = privateKeys;
});

extendEnvironment(
  ({
    network: {
      config: { accounts },
    },
  }: // ethers,
  HardhatRuntimeEnvironment) => {
    if (!accounts || (Array.isArray(accounts) && !accounts.length)) {
      console.error('Accounts:', accounts);
      throw new Error(
        'Incorrect accounts setting. Check your environment variables.'
      );
    }

    // ethers
    //   .getSigners()
    //   .then((signers) => {
    //     console.log(`🦇 signers`, signers[0]?.address);
    //   })
    //   .catch(() => undefined);
  }
);

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

export default config;
