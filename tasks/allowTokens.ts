import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { GetAllowedTokensArgs } from './getAllowedTokens';
import { getVerifiersFromArgs, getVerifiersFromFile } from './utils';

export type AllowedTokensArgs = GetAllowedTokensArgs & {
  tokenList: string;
};

export const allowTokens = async (
  { tokenList, verifierList }: AllowedTokensArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const tokenAddresses = tokenList.split(',');

  const verifiers = verifierList
    ? await getVerifiersFromArgs(verifierList, hre)
    : await getVerifiersFromFile(hre);

  for (const tokenAddress of tokenAddresses) {
    for (const verifier of verifiers) {
      try {
        await verifier.acceptToken(tokenAddress);
      } catch (error) {
        console.error(
          `Error adding token with address ${tokenAddress} to allowed tokens on Verifier at ${verifier.address}`
        );
        throw error;
      }
    }
  }
  console.log('Tokens allowed successfully!');
};
