const fs = require('fs');
const truffleConfig = require('../truffle');

// Primary contracts
const RelayHub = artifacts.require('RelayHub');
const Penalizer = artifacts.require('Penalizer');
const SmartWallet = artifacts.require('SmartWallet');
const SmartWalletFactory = artifacts.require('SmartWalletFactory');
const DeployVerifier = artifacts.require('DeployVerifier');
const RelayVerifier = artifacts.require('RelayVerifier');
const TestToken = artifacts.require('TestToken');

// For testing purposes
const SampleRecipient = artifacts.require('TestRecipient');

// For CustomSmartWallet support
const CustomSmartWallet = artifacts.require('CustomSmartWallet');
const CustomSmartWalletFactory = artifacts.require('CustomSmartWalletFactory');
const CustomSmartWalletDeployVerifier = artifacts.require(
    'CustomSmartWalletDeployVerifier'
);

// For NativeHolderSmartWallet support
const NativeHolderSmartWallet = artifacts.require('NativeHolderSmartWallet');

module.exports = async function (deployer, network) {
    await deployer.deploy(Penalizer);
    await deployer.deploy(RelayHub, Penalizer.address, 1, 1, 1, 1);
    await deployer.deploy(SmartWallet);

    await deployer.deploy(SmartWalletFactory, SmartWallet.address);
    const smartWalletFactoryAddress = SmartWalletFactory.address;

    await deployer.deploy(DeployVerifier, SmartWalletFactory.address);
    const deployVerifierAddress = DeployVerifier.address;

    await deployer.deploy(RelayVerifier, SmartWalletFactory.address);
    const relayVerifierAddress = RelayVerifier.address;

    await deployer.deploy(CustomSmartWallet);
    await deployer.deploy(CustomSmartWalletFactory, CustomSmartWallet.address);
    await deployer.deploy(
        CustomSmartWalletDeployVerifier,
        CustomSmartWalletFactory.address
    );
    await deployer.deploy(RelayVerifier, CustomSmartWalletFactory.address);

    const customSmartWalletRelayVerifierAddress = RelayVerifier.address;

    await deployer.deploy(NativeHolderSmartWallet);
    await deployer.deploy(SmartWalletFactory, NativeHolderSmartWallet.address);
    const nativeFactoryAddress = SmartWalletFactory.address;

    await deployer.deploy(DeployVerifier, SmartWalletFactory.address);
    const nativeDeployVerifierAddress = DeployVerifier.address;

    await deployer.deploy(RelayVerifier, SmartWalletFactory.address);
    const nativeRelayVerifierAddress = RelayVerifier.address;

    await deployer.deploy(TestToken);
    await deployer.deploy(SampleRecipient);

    console.log(
        '|=======================================|============================================|'
    );
    console.log(
        '| Contract                              | Address                                    |'
    );
    console.log(
        '|=======================================|============================================|'
    );
    console.log(
        `| Penalizer                             | ${Penalizer.address} |`
    );
    console.log(
        `| RelayHub                              | ${RelayHub.address} |`
    );
    console.log(
        '| Smart Wallet Contracts ============================================================|'
    );
    console.log(
        `| SmartWallet                           | ${SmartWallet.address} |`
    );
    console.log(
        `| SmartWalletFactory                    | ${smartWalletFactoryAddress} |`
    );
    console.log(
        `| SmartWalletDeployVerifier             | ${deployVerifierAddress} |`
    );
    console.log(
        `| SmartWalletRelayVerifier              | ${relayVerifierAddress} |`
    );
    console.log(
        '| Custom Smart Wallet Contracts =====================================================|'
    );
    console.log(
        `| CustomSmartWallet                     | ${CustomSmartWallet.address} |`
    );
    console.log(
        `| CustomSmartWalletFactory              | ${CustomSmartWalletFactory.address} |`
    );
    console.log(
        `| CustomSmartWalletDeployVerifier       | ${CustomSmartWalletDeployVerifier.address} |`
    );
    console.log(
        `| CustomSmartWalletRelayVerifier        | ${customSmartWalletRelayVerifierAddress} |`
    );
    console.log(
        '| Native Holder Smart Wallet Contracts ==============================================|'
    );
    console.log(
        `| NativeHolderSmartWallet               | ${NativeHolderSmartWallet.address} |`
    );
    console.log(
        `| NativeHolderSmartWalletFactory        | ${nativeFactoryAddress} |`
    );
    console.log(
        `| NativeHolderSmartWalletDeployVerifier | ${nativeDeployVerifierAddress} |`
    );
    console.log(
        `| NativeHolderSmartWalletRelayVerifier  | ${nativeRelayVerifierAddress} |`
    );
    console.log(
        '| Testing Contracts =================================================================|'
    );
    console.log(
        `| SampleRecipient                       | ${SampleRecipient.address} |`
    );
    console.log(
        `| TestToken                             | ${TestToken.address} |`
    );
    console.log(
        '|=======================================|============================================|\n'
    );

    console.log('Generating json config file...');

    const configFileName = 'contract-addresses.json';
    let jsonConfig;

    if (fs.existsSync(configFileName)) {
        jsonConfig = JSON.parse(
            fs.readFileSync(configFileName, { encoding: 'UTF-8' })
        );
    } else {
        jsonConfig = {};
    }

    const networkConfiguration = truffleConfig.networks[network];
    const networkId = networkConfiguration.network_id;

    jsonConfig[networkId] = {
        penalizer: Penalizer.address,
        relayHub: RelayHub.address,
        smartWallet: SmartWallet.address,
        smartWalletFactory: smartWalletFactoryAddress,
        smartWalletDeployVerifier: deployVerifierAddress,
        smartWalletRelayVerifier: relayVerifierAddress,
        customSmartWallet: CustomSmartWallet.address,
        customSmartWalletFactory: CustomSmartWalletFactory.address,
        customSmartWalletDeployVerifier:
            CustomSmartWalletDeployVerifier.address,
        customSmartWalletRelayVerifier: customSmartWalletRelayVerifierAddress,
        nativeSmartWallet: NativeHolderSmartWallet.address,
        nativeSmartWalletFactory: SmartWalletFactory.address,
        nativeSmartWalletDeployVerifier: DeployVerifier.address,
        nativeSmartWalletRelayVerifier: RelayVerifier.address,
        sampleRecipient: SampleRecipient.address,
        testToken: TestToken.address
    };

    fs.writeFileSync(configFileName, JSON.stringify(jsonConfig));
};
