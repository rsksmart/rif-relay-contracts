import { ContractTransaction } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getVerifiers } from './utils';

export const allowTokens = async (
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
    { acceptToken: (tokenAddress: string) => Promise<ContractTransaction> }
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
        await verifier.acceptToken(tokenAddress);
      } catch (error) {
        console.error(
          `Error adding token with address ${tokenAddress} to allowed tokens on ${key}`
        );
        throw error;
      }
    }
  }
  console.log('Tokens allowed successfully!');
};
