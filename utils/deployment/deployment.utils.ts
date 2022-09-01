import {
  Contract as Contract,
  ContractFactory as EthersContractFactory,
} from 'ethers/lib/ethers';
import { ethers } from 'hardhat';

export interface ContractFactory<C extends Contract>
  extends EthersContractFactory {
  deploy: (...args: Array<unknown>) => Promise<C>;
}

export type DeployerParam<
  C extends Contract,
  A extends {} = ContractFactory<C>['deploy']
> = {
  contractName: string;
  constructorArgs: A;
  contractFactory?: ContractFactory<C>;
};

export const getContractFactory = async <
  C extends Contract,
  F extends ContractFactory<C>
>({
  contractName,
  signerOrOptions,
}: typeof ethers.getContractFactory.arguments) =>
  ethers.getContractFactory(contractName, signerOrOptions) as Promise<F>;

export type DeployerReturnType<C extends Contract> = Promise<{
  contract: C;
  factory: ContractFactory<C>;
}>;

export const deployContract = async <
  C extends Contract,
  A extends {} = ContractFactory<C>['deploy']
>({
  contractName,
  constructorArgs,
  contractFactory,
}: DeployerParam<C, A>): DeployerReturnType<C> => {
  const options = Object.values(constructorArgs);
  const factory =
    contractFactory ??
    (await getContractFactory<C, ContractFactory<C>>({ contractName }));

  return {
    contract: await factory.deploy(...options),
    factory,
  };
};
