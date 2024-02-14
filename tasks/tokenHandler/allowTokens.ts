import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { GetAllowedTokensArgs } from './getAllowedTokens';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { TokenHandler } from 'typechain-types';

export type AllowedTokensArgs = GetAllowedTokensArgs & {
  tokenList: string;
};

export const allowTokens = async (
  { tokenList, verifierList }: AllowedTokensArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const tokenAddresses = tokenList.split(',');

  const verifiers: TokenHandler[] = verifierList
    ? await getVerifiersFromArgs(verifierList, hre, 'Token')
    : await getVerifiersFromFile(hre, 'Token');

  for (const tokenAddress of tokenAddresses) {
    for (const verifier of verifiers) {
      try {
        const tx = await verifier.acceptToken(tokenAddress);
        console.log(`Sent transaction ${tx.hash}`);
      } catch (error) {
        console.error(
          `Error adding token with address ${tokenAddress} to allowed tokens on Verifier at ${verifier.address}`
        );
        throw error;
      }
    }
  }
};
