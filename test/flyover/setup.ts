import { ProgrammableContractFunction, smock } from '@defi-wonderland/smock';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  FlyoverDeployVerifier,
  FlyoverSmartWallet,
  FlyoverSmartWalletFactory,
} from 'typechain-types';
import { deployContract } from '../../utils/deployment/deployment.utils';
import {
  FlyoverPegInQuote,
  hashFlyoverPegInQuote,
  PEGIN_FAKE_ABI,
} from './utils';

export const FLYOVER_OWNER_SLOT =
  '0xa7b53796fd2d99cb1f5ae019b54f9e024446c3d12b483f733ccc62ed04eb126a';

const COLLATERAL_FAKE_ABI = [
  'function getRewards(address) external view returns (uint256)',
  'function getRewardPercentage() external view returns (uint256)',
  'function withdrawRewards(address payable) external',
];

export type FlyoverPegInFake = {
  address: string;
  hashPegInQuote: ProgrammableContractFunction;
  getQuoteStatus: ProgrammableContractFunction;
  registerPegIn: ProgrammableContractFunction;
};

export type FlyoverCollateralFake = {
  address: string;
  getRewards: ProgrammableContractFunction;
  getRewardPercentage: ProgrammableContractFunction;
  withdrawRewards: ProgrammableContractFunction;
};

export const createFlyoverPegInFake = async (): Promise<FlyoverPegInFake> =>
  smock.fake(PEGIN_FAKE_ABI) as unknown as Promise<FlyoverPegInFake>;

export const createFlyoverCollateralFake =
  async (): Promise<FlyoverCollateralFake> =>
    smock.fake(
      COLLATERAL_FAKE_ABI
    ) as unknown as Promise<FlyoverCollateralFake>;

export type FlyoverTestContext = {
  pegInFake: FlyoverPegInFake;
  collateralFake: FlyoverCollateralFake;
  template: FlyoverSmartWallet;
  factory: FlyoverSmartWalletFactory;
  deployVerifier: FlyoverDeployVerifier;
  setQuoteStatus: (quote: FlyoverPegInQuote, status: number) => void;
  setWalletReward: (walletAddress: string, reward: BigNumber) => void;
  setRewardPercentage: (percentage: number) => void;
  configureRegisterPegInSuccess: (registerResult?: number) => void;
  configureRegisterPegInRevert: (message: string) => void;
};

const firstArg = (args: unknown): unknown =>
  Array.isArray(args) ? args[0] : args;

const normalizeQuote = (raw: unknown): FlyoverPegInQuote => {
  const quote = raw as FlyoverPegInQuote & unknown[];
  if (Array.isArray(quote)) {
    return {
      chainId: quote[0] as number,
      callFee: (quote[1] as BigNumber).toString(),
      penaltyFee: (quote[2] as BigNumber).toString(),
      value: (quote[3] as BigNumber).toString(),
      gasFee: (quote[4] as BigNumber).toString(),
      fedBtcAddress: quote[5] as string,
      lbcAddress: quote[6] as string,
      liquidityProviderRskAddress: quote[7] as string,
      contractAddress: quote[8] as string,
      rskRefundAddress: quote[9] as string,
      nonce: quote[10] as number,
      gasLimit: quote[11] as number,
      agreementTimestamp: quote[12] as number,
      timeForDeposit: quote[13] as number,
      callTime: quote[14] as number,
      depositConfirmations: quote[15] as number,
      callOnRegister: quote[16] as boolean,
      btcRefundAddress: quote[17] as string,
      liquidityProviderBtcAddress: quote[18] as string,
      data: quote[19] as string,
    };
  }

  const peginQuote = quote as FlyoverPegInQuote;

  return {
    ...peginQuote,
    callFee: peginQuote.callFee.toString(),
    penaltyFee: peginQuote.penaltyFee.toString(),
    value: peginQuote.value.toString(),
    gasFee: peginQuote.gasFee.toString(),
  };
};

export const deployFlyoverTestContext =
  async (): Promise<FlyoverTestContext> => {
    const quoteStatuses: Record<string, number> = {};
    const walletRewards: Record<string, BigNumber> = {};

    const pegInFake = await createFlyoverPegInFake();
    const collateralFake = await createFlyoverCollateralFake();

    pegInFake.hashPegInQuote.returns((args: unknown) =>
      hashFlyoverPegInQuote(normalizeQuote(firstArg(args)))
    );
    pegInFake.getQuoteStatus.returns((args: unknown) => {
      const quoteHash = firstArg(args) as string;

      return quoteStatuses[quoteHash.toLowerCase()] ?? 0;
    });
    pegInFake.registerPegIn.returns(1);

    collateralFake.getRewardPercentage.returns(10_000);
    collateralFake.getRewards.returns((args: unknown) => {
      const addr = (firstArg(args) as string).toLowerCase();

      return walletRewards[addr] ?? BigNumber.from(0);
    });
    collateralFake.withdrawRewards.returns(undefined);

    const { contract: template } = await deployContract<
      FlyoverSmartWallet,
      [string, string]
    >({
      contractName: 'FlyoverSmartWallet',
      constructorArgs: [pegInFake.address, collateralFake.address],
    });

    const { contract: factory } = await deployContract<
      FlyoverSmartWalletFactory,
      [string]
    >({
      contractName: 'FlyoverSmartWalletFactory',
      constructorArgs: [template.address],
    });

    const { contract: deployVerifier } = await deployContract<
      FlyoverDeployVerifier,
      [string]
    >({
      contractName: 'FlyoverDeployVerifier',
      constructorArgs: [factory.address],
    });

    await deployVerifier.acceptContract(pegInFake.address);

    return {
      pegInFake,
      collateralFake,
      template,
      factory,
      deployVerifier,
      setQuoteStatus: (quote, status) => {
        quoteStatuses[hashFlyoverPegInQuote(quote).toLowerCase()] = status;
      },
      setWalletReward: (walletAddress, reward) => {
        walletRewards[walletAddress.toLowerCase()] = reward;
      },
      setRewardPercentage: (percentage) => {
        collateralFake.getRewardPercentage.reset();
        collateralFake.getRewardPercentage.returns(percentage);
      },
      configureRegisterPegInSuccess: (registerResult = 1) => {
        pegInFake.registerPegIn.reset();
        pegInFake.registerPegIn.returns(registerResult);
      },
      configureRegisterPegInRevert: (message: string) => {
        pegInFake.registerPegIn.reset();
        pegInFake.registerPegIn.reverts(message);
      },
    };
  };

export const deployUninitializedFlyoverWallet = async (
  pegInAddress: string,
  collateralAddress: string
): Promise<FlyoverSmartWallet> => {
  const walletFactory = await ethers.getContractFactory('FlyoverSmartWallet');
  const wallet = await walletFactory.deploy(pegInAddress, collateralAddress);

  await ethers.provider.send('hardhat_setStorageAt', [
    wallet.address,
    FLYOVER_OWNER_SLOT,
    ethers.utils.hexZeroPad('0x00', 32),
  ]);

  return wallet;
};
