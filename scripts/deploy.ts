import { constants } from 'ethers';
import { ethers } from 'hardhat';

// FIXME:  add contract deployment
const main = async () => {
  await ethers.getContractAt('CustomSmartWallet', constants.AddressZero);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
