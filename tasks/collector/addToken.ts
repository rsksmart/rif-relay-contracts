import { HardhatRuntimeEnvironment } from 'hardhat/types';

export type ManageCollectorTokenArgs = {
  collectorAddress: string;
  tokenAddress: string;
};

export const addTokenToCollector = async (
  { collectorAddress, tokenAddress }: ManageCollectorTokenArgs,
  { ethers }: HardhatRuntimeEnvironment
) => {
  const collector = await ethers.getContractAt('Collector', collectorAddress);

  try {
    await collector.addToken(tokenAddress);
  } catch (error) {
    console.error(
      `Error adding token with address ${tokenAddress} to allowed tokens on Collector ${collectorAddress}`
    );
    throw error;
  }
};
