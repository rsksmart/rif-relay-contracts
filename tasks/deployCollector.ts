import * as fs from 'fs';

import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Collector } from '../typechain-types';

export const DEFAULT_CONFIG_FILE_NAME = 'deploy-collector.input.json';
export const DEFAULT_OUTPUT_FILE_NAME = 'revenue-sharing-addresses.json';

export interface Partner {
  beneficiary: string;
  share: number;
}

export type CollectorConfig = {
  collectorOwner: string;
  partners: Partner[];
  tokenAddresses: string[];
  remainderAddress: string;
};

export type DeployCollectorArg = {
  configFileName?: string;
  outputFileName?: string;
};

type ChainId = string;
type OutputCollectorConfig = CollectorConfig | { collectorContract: string };
export type OutputConfig = Record<ChainId, OutputCollectorConfig>;

export const deployCollector = async (
  taskArgs: DeployCollectorArg,
  hre: HardhatRuntimeEnvironment
) => {
  const { ethers, network } = hre;

  if (!network) {
    throw new Error('Unknown Network');
  }

  let configFileName = taskArgs.configFileName;

  if (!configFileName) {
    console.warn(
      "Missing '--config-file-name' parameter, 'deploy-collector.input.json' will be used"
    );
    configFileName = DEFAULT_CONFIG_FILE_NAME;
  }

  if (!fs.existsSync(configFileName)) {
    throw new Error('Could not find Collector configuration file');
  }

  const inputConfig = JSON.parse(
    fs.readFileSync(configFileName, { encoding: 'utf-8' })
  ) as CollectorConfig;

  const { collectorOwner, partners, tokenAddresses, remainderAddress } =
    inputConfig;

  const collectorFactory = await ethers.getContractFactory('Collector');
  const collector = await collectorFactory.deploy(
    collectorOwner,
    tokenAddresses,
    partners,
    remainderAddress
  );

  await printReceipt(collector);

  const partnerPrintings = partners.reduce<Record<string, string>>(function (
    accumulator,
    { beneficiary, share },
    i
  ) {
    return {
      ...accumulator,
      [`Partner ${i}`]: `${beneficiary}, ${share}%`,
    };
  },
  {});

  const objToPrint = {
    'Collector Contract': collector.address,
    'Collector Owner': await collector.owner(),
    'Collector Tokens': await collector.getTokens(),
    'Collector Remainder': remainderAddress,
    ...partnerPrintings,
  };
  console.table(objToPrint);

  console.log('Generating json config file...');

  const outputFileName = taskArgs.outputFileName ?? DEFAULT_OUTPUT_FILE_NAME;

  let jsonConfig: OutputConfig;

  if (fs.existsSync(outputFileName)) {
    jsonConfig = JSON.parse(
      fs.readFileSync(outputFileName, { encoding: 'utf-8' })
    ) as OutputConfig;
  } else {
    jsonConfig = {};
  }

  const networkId = (await ethers.provider.getNetwork()).chainId;
  jsonConfig[networkId] = {
    collectorContract: collector.address,
    collectorOwner: await collector.owner(),
    tokenAddresses: await collector.getTokens(),
    remainderAddress: remainderAddress,
    partners,
  };

  fs.writeFileSync(outputFileName, JSON.stringify(jsonConfig));
};

async function printReceipt(collector: Collector) {
  const printLine = () => console.log('-'.repeat(98));

  console.log('Transaction Receipt');
  printLine();

  const txReceipt = await collector.deployTransaction.wait();

  const receiptToPrint = {
    hash: collector.deployTransaction.hash,
    from: txReceipt.from,
    blockNumber: txReceipt.blockNumber,
    gasUsed: txReceipt.gasUsed.toString(),
  };

  for (const [key, value] of Object.entries(receiptToPrint)) {
    console.log(
      `> ${key} ` +
        `${' '.repeat(20 - key.length)}` +
        `| ${value} ` +
        `${' '.repeat(70 - value.toString().length)} |`
    );
  }

  printLine();
  console.log();
}
