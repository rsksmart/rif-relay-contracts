import { BigNumberish } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ICollector } from 'typechain-types/contracts/Collector';
import { parseJsonFile } from './utils';

export type ChangePartnerSharesArg = {
  collectorAddress: string;
  partnerConfig: string;
  gasLimit?: BigNumberish;
};

export type PartnerConfig = {
  partners: ICollector.RevenuePartnerStruct[];
};

const defaultTxGas = 150000;

export const changePartnerShares = async (
  {
    collectorAddress,
    partnerConfig,
    gasLimit = defaultTxGas,
  }: ChangePartnerSharesArg,
  hre: HardhatRuntimeEnvironment
) => {
  const { ethers } = hre;

  const parsedPartnerConfig = parseJsonFile<PartnerConfig>(partnerConfig);
  const collector = await ethers.getContractAt('Collector', collectorAddress);

  try {
    await collector.updateShares(parsedPartnerConfig.partners, { gasLimit });
  } catch (error) {
    console.error(
      `Error updating partners of collector with address ${collectorAddress}`
    );
    throw error;
  }

  parsedPartnerConfig.partners.forEach(({ beneficiary, share }, index) => {
    console.dir({ index, beneficiary, share });
  });
};
