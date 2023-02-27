import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ManageCollectorTokenArgs } from './addToken';

export const removeTokenFromCollector = async (
  { collectorAddress, tokenAddress }: ManageCollectorTokenArgs,
  { ethers }: HardhatRuntimeEnvironment
) => {
  const collector = await ethers.getContractAt('Collector', collectorAddress);

  try {
    const tokens = await collector.getTokens();
    const tokenIndex = tokens.findIndex((token) => token === tokenAddress);
    if (tokenIndex < 0) {
      throw new Error(
        `Token with address ${tokenAddress} not found. Please verify the tokens managed by the Collector ${collectorAddress}`
      );
    }
    console.log(`Token found with index ${tokenIndex}`);
    await collector.removeToken(tokenAddress, tokenIndex);
  } catch (error) {
    console.error(
      `Error removing token with address ${tokenAddress} from Collector ${collectorAddress}`
    );
    throw error;
  }
};
