import { deployContracts, generateJsonConfig } from './modules/deploy'

const main = async () => {
  const contractAddresses = await deployContracts();
  console.table(contractAddresses);
  generateJsonConfig(contractAddresses);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
