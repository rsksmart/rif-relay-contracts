import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { AllowedTokensArgs } from './allowTokens';
import { getVerifiersFromArgs, getVerifiersFromFile } from '../utils';
import { TokenHandler } from 'typechain-types';

export const removeTokens = async (
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
        const index = (await verifier.getAcceptedTokens()).indexOf(
          tokenAddress
        );
        if (index === -1) {
          console.log(
            `Token with address ${tokenAddress} is not accepted on Verifier at ${verifier.address}`
          );
          continue;
        }
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
