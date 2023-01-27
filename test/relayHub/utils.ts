import { MockContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish, ContractTransaction } from 'ethers';
import { RelayHub, RelayHub__factory } from 'typechain-types';
import { PromiseOrValue } from 'typechain-types/common';
import { RelayHubOptions } from 'utils/deployment/relayHub.utils';

export const MAX_WORKER_COUNT: BigNumberish = 1,
  MINIMUM_ENTRY_DEPOSIT_VALUE: BigNumberish = 1,
  MINIMUM_UNSTAKE_DELAY: BigNumberish = 10,
  MINIMUM_STAKE: BigNumberish = 1;

export const createContractDeployer =
  (penalizer: PromiseOrValue<string>) =>
  async ([
    penalizerOverride,
    maxWorkerCount,
    minimumEntryDepositValue,
    minimumUnstakeDelay,
    minimumStake,
  ]: Partial<RelayHubOptions> = []) => {
    const relayHubFactory = await smock.mock<RelayHub__factory>('RelayHub');

    return relayHubFactory.deploy(
      penalizerOverride ?? penalizer,
      maxWorkerCount ?? MAX_WORKER_COUNT,
      minimumEntryDepositValue ?? MINIMUM_ENTRY_DEPOSIT_VALUE,
      minimumUnstakeDelay ?? MINIMUM_UNSTAKE_DELAY,
      minimumStake ?? MINIMUM_STAKE
    );
  };

export const addWorkerForManager = ({
  relayHub,
  relayManager,
  relayWorker,
}: {
  relayHub: RelayHub | MockContract<RelayHub>;
  relayManager: SignerWithAddress;
  relayWorker: SignerWithAddress;
}): (() => Promise<ContractTransaction>) => {
  return () =>
    relayHub.connect(relayManager).addRelayWorkers([relayWorker.address]);
};
