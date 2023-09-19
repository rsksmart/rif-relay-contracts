import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AllowedTokensArgs } from './allowTokens';
import { getVerifiersFromArgs, getVerifiersFromFile } from './utils';

export const removeTokens = async (
  {tokenList, verifierList}: AllowedTokensArgs,
  hre: HardhatRuntimeEnvironment
) => {

  const tokenAddresses = tokenList.split(',');

  const verifiers = verifierList ? await getVerifiersFromArgs(verifierList, hre) : await getVerifiersFromFile(hre);

  for (const tokenAddress of tokenAddresses) {
    for (const verifier of verifiers) {
      try {
        const index = (await verifier.getAcceptedTokens()).indexOf(
          tokenAddress
        );
        await verifier.removeToken(tokenAddress, index);
      } catch (error) {
        console.error(
          `Error removing token with address ${tokenAddress} from allowed tokens on Verifier at ${verifier.address}`
        );
        throw error;
      }
    }
  }
  console.log('Tokens removed successfully!');
};
