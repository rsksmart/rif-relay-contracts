import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ManageCollectorTokenArgs } from './addToken';

export type GetCollectorTokensArgs = Omit<
  ManageCollectorTokenArgs,
  'tokenAddress'
>;

export const getCollectorTokens = async (
  { collectorAddress }: GetCollectorTokensArgs,
  { ethers }: HardhatRuntimeEnvironment
) => {
  const collector = await ethers.getContractAt('Collector', collectorAddress);

  try {
    const tokens = await collector.getTokens();
    console.log('Allowed Tokens:', tokens);
  } catch (error) {
    console.error(`Error retrieving tokens from Collector ${collectorAddress}`);
    throw error;
  }
};
