import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { UtilToken } from 'typechain-types';

export type MintArgs = {
  tokenAddress: string;
  amount: string;
  receiver: string;
};

export const mint = async (
  { tokenAddress, amount, receiver }: MintArgs,
  hre: HardhatRuntimeEnvironment
) => {
  const { ethers, network } = hre;

  if (!network) {
    throw new Error('Unknown Network');
  }

  const { chainId } = network.config;

  if (!chainId) {
    throw new Error('Unknown Chain Id');
  }
  const abi = ['function mint(uint256 amount, address to) public'];

  const signer = (await ethers.getSigners())[0];
  const mintContract = new ethers.Contract(
    tokenAddress,
    abi,
    signer
  ) as UtilToken;
  await mintContract.mint(amount, receiver);

  console.log('Token minted successfully!');
};
