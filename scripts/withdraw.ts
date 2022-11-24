import { BigNumber, utils } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

type MinimumErc20TokenContract = {
  balanceOf: (address: string) => Promise<BigNumber>;
};

const printStatus = async (
  collectorAddress: string,
  partners: string[],
  erc20TokenInstance: MinimumErc20TokenContract
) => {
  const collectorBalance = await erc20TokenInstance.balanceOf(collectorAddress);

  console.log(`Collector balance: ${collectorBalance.toNumber()}`);
  for (const owner of partners) {
    const balance = await erc20TokenInstance.balanceOf(owner);
    console.log(`Address ${owner} balance: ${balance.toNumber()}`);
  }
};

export const withdraw = async (
  {
    collectorAddress,
    tokenAddress,
    partners,
  }: {
    collectorAddress: string;
    tokenAddress: string;
    partners: string;
  },
  hre: HardhatRuntimeEnvironment
) => {
  if (!utils.isAddress(collectorAddress)) {
    throw new Error(`invalid "collectorAddress": ${collectorAddress}`);
  }

  const parsedPartners = partners && partners.split(',');
  if (!parsedPartners) {
    throw new Error(`invalid "partners": ${partners}`);
  }

  const minABI = [
    // balanceOf
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
  ];

  const erc20TokenInstance = (await hre.ethers.getContractAt(
    minABI,
    tokenAddress
  )) as unknown as MinimumErc20TokenContract;

  console.log('---Token balance before---');
  await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);

  const collectorInstance = await hre.ethers.getContractAt(
    'Collector',
    collectorAddress
  );

  const gasRequired = '200000';
  await collectorInstance.withdraw({
    gasPrice: gasRequired,
  });

  console.log('---Token balance after---');
  await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);
};
