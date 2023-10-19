import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiersFromArgs, getVerifiersFromFile } from './utils';

export type GetAllowedTokensArgs = {
  verifierList?: string;
};

export const getAllowedTokens = async (
  { verifierList }: GetAllowedTokensArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const verifiers = verifierList
    ? await getVerifiersFromArgs(verifierList, hre)
    : await getVerifiersFromFile(hre);

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
