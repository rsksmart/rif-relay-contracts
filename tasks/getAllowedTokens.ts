import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiers } from './utils';

export const getAllowedTokens = async (hre: HardhatRuntimeEnvironment) => {

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
    { getAcceptedTokens: () => Promise<string[]> }
  > = new Map();
  verifierMap.set('deployVerifier', deployVerifier);
  verifierMap.set('relayVerifier', relayVerifier);
  verifierMap.set('customDeployVerifier', customDeployVerifier);
  verifierMap.set('customRelayVerifier', customRelayVerifier);
  verifierMap.set('nativeHolderDeployVerifier', nativeHolderDeployVerifier);
  verifierMap.set('nativeHolderRelayVerifier', nativeHolderRelayVerifier);

  for (const [key, verifier] of verifierMap) {
    try {
      const allowedTokens = await verifier.getAcceptedTokens();
      console.log(key, allowedTokens);
    } catch (error) {
      console.error(`Error getting allowed tokens for ${key}`);
      throw error;
    }
  }
};
