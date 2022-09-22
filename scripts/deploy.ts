import { ethers, hardhatArguments, config } from 'hardhat';
import fs from 'fs';
import { IContractAddresses } from './interfaces/contracts';

const main = async () => {
  const relayHubF = await ethers.getContractFactory('RelayHub');
  const penalizerF = await ethers.getContractFactory('Penalizer');
  const smartWalletF = await ethers.getContractFactory('SmartWallet');
  const smartWalletFactoryF = await ethers.getContractFactory(
    'SmartWalletFactory'
  );
  const deployVerifierF = await ethers.getContractFactory('DeployVerifier');
  const relayVerifierF = await ethers.getContractFactory('RelayVerifier');
  const utilTokenF = await ethers.getContractFactory('UtilToken');

  const customSmartWalletF = await ethers.getContractFactory(
    'CustomSmartWallet'
  );
  const customSmartWalletFactoryF = await ethers.getContractFactory(
    'CustomSmartWalletFactory'
  );
  const customSmartWalletDeployVerifierF = await ethers.getContractFactory(
    'CustomSmartWalletDeployVerifier'
  );

  const { address: penalizerAddress } = await penalizerF.deploy();
  const { address: relayHubAddress } = await relayHubF.deploy(
    penalizerAddress,
    1,
    1,
    1,
    1
  );
  const { address: smartWalletAddress } = await smartWalletF.deploy();
  const { address: smartWalletFactoryAddress } =
    await smartWalletFactoryF.deploy(smartWalletAddress);
  const { address: deployVerifierAddress } = await deployVerifierF.deploy(
    smartWalletFactoryAddress
  );
  const { address: relayVerifierAddress } = await relayVerifierF.deploy(
    smartWalletFactoryAddress
  );

  const { address: customSmartWalletAddress } =
    await customSmartWalletF.deploy();
  const { address: customSmartWalletFactoryAddress } =
    await customSmartWalletFactoryF.deploy(customSmartWalletAddress);
  const { address: customDeployVerifierAddress } =
    await customSmartWalletDeployVerifierF.deploy(
      customSmartWalletFactoryAddress
    );

  const { address: customRelayVerifierAddress } = await relayVerifierF.deploy(
    customSmartWalletFactoryAddress
  );

  const { address: utilTokenAddress } = await utilTokenF.deploy();

  const contractAddresses = {
    Penalizer: penalizerAddress,
    RelayHub: relayHubAddress,
    SmartWallet: smartWalletAddress,
    SmartWalletFactory: smartWalletFactoryAddress,
    SmartWalletDeployVerifier: deployVerifierAddress,
    SmartWalletRelayVerifier: relayVerifierAddress,
    CustomSmartWallet: customSmartWalletAddress,
    CustomSmartWalletFactory: customSmartWalletFactoryAddress,
    CustomSmartWalletDeployVerifier: customDeployVerifierAddress,
    CustomSmartWalletRelayVerifier: customRelayVerifierAddress,
    UtilToken: utilTokenAddress,
  };

  console.table(contractAddresses);

  console.log('Generating json config file...');

  const configFileName = 'contract-addresses.json';
  let jsonConfig: Partial<IContractAddresses>;

  if (fs.existsSync(configFileName)) {
    jsonConfig = JSON.parse(
      fs.readFileSync(configFileName, { encoding: 'utf-8' })
    ) as IContractAddresses;
  } else {
    jsonConfig = {};
  }

  const { network  } = hardhatArguments;
  if(!network) {
    throw new Error('Unknown Network');
  }
  const { chainId } = config.networks[network]

  if(!chainId) {
    throw new Error('Unknown Chain Id');
  }
  
  jsonConfig[chainId] = contractAddresses

  fs.writeFileSync('contract-addresses.json', JSON.stringify(jsonConfig));
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
