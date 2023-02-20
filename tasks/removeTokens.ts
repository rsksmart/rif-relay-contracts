import { ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiers } from './utils';

export const removeTokens = async (
  taskArgs: { tokenlist: string },
  hre: HardhatRuntimeEnvironment
) => {
  const tokenAddresses = taskArgs.tokenlist.split(',');

  const {
    deployVerifier,
    relayVerifier,
    customDeployVerifier,
    customRelayVerifier,
    nativeHolderDeployVerifier,
    nativeHolderRelayVerifier,
  } = await getVerifiers(hre);

  const verifierMap: Map<
    string,
    {
      removeToken: (
        tokenAddress: string,
        index: number
      ) => Promise<ContractTransaction>;
      getAcceptedTokens: () => Promise<string[]>;
    }
  > = new Map();

  verifierMap.set('deployVerifier', deployVerifier);
  verifierMap.set('relayVerifier', relayVerifier);
  verifierMap.set('customDeployVerifier', customDeployVerifier);
  verifierMap.set('customRelayVerifier', customRelayVerifier);
  verifierMap.set('nativeHolderDeployVerifier', nativeHolderDeployVerifier);
  verifierMap.set('nativeHolderRelayVerifier', nativeHolderRelayVerifier);

  for (const tokenAddress of tokenAddresses) {
    for (const [key, verifier] of verifierMap) {
      try {
        const index = (await verifier.getAcceptedTokens()).indexOf(
          tokenAddress
        );
        await verifier.removeToken(tokenAddress, index);
      } catch (error) {
        console.error(
          `Error removing token with address ${tokenAddress} from allowed tokens on ${key}`
        );
        throw error;
      }
    }
  }
  console.log('Tokens removed successfully!');
};
