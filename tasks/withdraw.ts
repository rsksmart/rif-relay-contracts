import { BigNumber, BigNumberish } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { parseJsonFile } from './utils';
import type { PartnerConfig } from './changePartnerShares';
import { PromiseOrValue } from 'typechain-types/common';

export type WithdrawSharesArg = {
  collectorAddress: string;
  partnerConfig: string;
  gasLimit?: BigNumberish;
};

type MinimumErc20TokenContract = {
  balanceOf: (address: string) => Promise<BigNumber>;
};

const printStatus = async (
  collectorAddress: string,
  partners: PromiseOrValue<string>[],
  erc20TokenInstance: MinimumErc20TokenContract
) => {
  const collectorBalance = await erc20TokenInstance.balanceOf(collectorAddress);

  console.log(`Collector balance: ${collectorBalance.toNumber()}`);
  for (const partner of partners) {
    const balance = await erc20TokenInstance.balanceOf(await partner);
    console.log(`Address ${await partner} balance: ${balance.toNumber()}`);
  }
};

const DEFAULT_TX_GAS = 200000;

export const withdraw = async (
  {
    collectorAddress,
    partnerConfig,
    gasLimit = DEFAULT_TX_GAS,
  }: WithdrawSharesArg,
  hre: HardhatRuntimeEnvironment
) => {
  const parsedPartnerConfig = parseJsonFile<PartnerConfig>(partnerConfig);

  const parsedPartners = parsedPartnerConfig.partners.map((partnerConfig) => {
    return partnerConfig.beneficiary;
  });

  if (!parsedPartners.length) {
    throw new Error(`invalid partners in ${partnerConfig}`);
  }

  const { tokenAddress } = parsedPartnerConfig;

  const minABI = [
    // balanceOf
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
  ];

  const erc20TokenInstance = (await hre.ethers.getContractAt(
    minABI,
    tokenAddress
  )) as unknown as MinimumErc20TokenContract;

  console.log('---Token balance before---');
  await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);

  const collector = await hre.ethers.getContractAt(
    'Collector',
    collectorAddress
  );

  try {
    await collector.withdraw({ gasLimit });
  } catch (error) {
    console.error(
      `Error withdrawing funds from collector with address ${collectorAddress}`
    );
    throw error;
  }

  console.log('---Token balance after---');
  await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);
};
