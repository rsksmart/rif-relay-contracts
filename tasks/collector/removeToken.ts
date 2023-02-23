import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AddCollectorTokenArgs } from './addToken';

export type RemoveCollectorTokenArgs = AddCollectorTokenArgs & {
  tokenIndex: number;
};

export const removeTokenFromCollector = async (
  { collectorAddress, tokenAddress, tokenIndex }: RemoveCollectorTokenArgs,
  { ethers }: HardhatRuntimeEnvironment
) => {
  const collector = await ethers.getContractAt('Collector', collectorAddress);

  try {
    const tokens = await collector.getTokens();
    if (tokenIndex >= tokens.length || tokenAddress !== tokens[tokenIndex]) {
      throw new Error(
        `The token index provided isn't correct. Please verify the tokens managed by the Collector ${collectorAddress}`
      );
    }
    await collector.removeToken(tokenAddress, tokenIndex);
  } catch (error) {
    console.log(error.message);
    console.error(
      `Error removing token with address ${tokenAddress} and index ${tokenIndex} from Collector ${collectorAddress}`
    );
    throw error;
  }
};
