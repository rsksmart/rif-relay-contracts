import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { TokenHandler } from 'typechain-types';

export type GetAllowedTokensArgs = {
  verifierList?: string;
};

export const getAllowedTokens = async (
  { verifierList }: GetAllowedTokensArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const verifiers: TokenHandler[] = verifierList
    ? await getVerifiersFromArgs(verifierList, hre, 'Token')
    : await getVerifiersFromFile(hre, 'Token');

  for (const verifier of verifiers) {
    try {
      const allowedTokens = await verifier.getAcceptedTokens();
      console.log(
        `Verifier: ${verifier.address}, allowedTokens `,
        allowedTokens
      );
    } catch (error) {
      console.error(
        `Error getting allowed tokens for verifier at ${verifier.address}`
      );
      throw error;
    }
  }
};
