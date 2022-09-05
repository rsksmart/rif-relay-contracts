import {
  ContractFactory,
  deployContract,
  DeployerReturnType,
} from './deployment.utils';
import { RelayHub, RelayHub__factory } from 'typechain-types';

export type RelayHubOptions = Parameters<RelayHub__factory['deploy']>;
export const deployRelayHub = async <C extends RelayHub>(
  options: RelayHubOptions,
  contractFactory?: ContractFactory<C>
): DeployerReturnType<C> =>
  deployContract<C, RelayHubOptions>({
    contractName: 'RelayHub',
    constructorArgs: options,
    contractFactory,
  });
