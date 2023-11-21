import { BigNumber, BigNumberish } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { PromiseOrValue } from 'typechain-types/common';

export type WithdrawSharesArg = {
  collectorAddress: string;
  tokenAddress?: string;
  gasLimit?: BigNumberish;
};

type MinimumErc20TokenContract = {
  balanceOf: (address: string) => Promise<BigNumber>;
};

const MINIMUM_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
];

export const DEFAULT_TX_GAS = 200000;

const printStatus = async (
  collectorAddress: string,
  partners: PromiseOrValue<string>[],
  tokenAddresses: string[],
  hre: HardhatRuntimeEnvironment
) => {
  for (const tokenAddress of tokenAddresses) {
    console.log(`\tToken address: ${tokenAddress}`);

    const tokenInstance = (await hre.ethers.getContractAt(
      MINIMUM_ABI,
      tokenAddress
    )) as unknown as MinimumErc20TokenContract;

    const collectorBalance = await tokenInstance.balanceOf(collectorAddress);

    console.log(`\t\tCollector balance: ${collectorBalance.toString()}`);

    for (const partner of partners) {
      const balance = await tokenInstance.balanceOf(await partner);
      console.log(
        `\t\tAddress ${await partner} balance: ${balance.toString()}`
      );
    }
  }
};

export const withdraw = async (
  {
    collectorAddress,
    tokenAddress,
    gasLimit = DEFAULT_TX_GAS,
  }: WithdrawSharesArg,
  hre: HardhatRuntimeEnvironment
) => {
  const collector = await hre.ethers.getContractAt(
    'Collector',
    collectorAddress
  );

  const partners = await collector.getPartners();
  console.log('partners: ', partners);

  const partnersAddresses = partners.map((partner) => {
    return partner.beneficiary;
  });

  const tokenAddressesToWithdraw = tokenAddress
    ? [tokenAddress]
    : await collector.getTokens();

  console.log('---Balance before---');
  await printStatus(
    collectorAddress,
    partnersAddresses,
    tokenAddressesToWithdraw,
    hre
  );

  try {
    const transaction = tokenAddress
      ? await collector.withdrawToken(tokenAddress, { gasLimit })
      : await collector.withdraw({ gasLimit });

    await transaction.wait();
  } catch (error) {
    console.error(
      `Error withdrawing funds from collector with address ${collectorAddress}: ${
        (error as Error).message
      }`
    );

    throw error;
  }

  console.log('---Balance after---');
  await printStatus(
    collectorAddress,
    partnersAddresses,
    tokenAddressesToWithdraw,
    hre
  );
};
