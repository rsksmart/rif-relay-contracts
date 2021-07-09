// interfaces
const EnvelopingTypes = require('./build/contracts/EnvelopingTypes.json');
const ICustomSmartWalletFactory = require('./build/contracts/ICustomSmartWalletFactory.json');
const IDeployVerifier = require('./build/contracts/IDeployVerifier.json');
const IForwarder = require('./build/contracts/IForwarder.json');
const IPenalizer = require('./build/contracts/IPenalizer.json');
const IRelayHub = require('./build/contracts/IRelayHub.json');
const IRelayVerifier = require('./build/contracts/IRelayVerifier.json');
const ISmartWalletFactory = require('./build/contracts/ISmartWalletFactory.json');
const ITokenHandler = require('./build/contracts/ITokenHandler.json');
const IVersionRegistry = require('./build/contracts/IVersionRegistry.json');
const IWalletCustomLogic = require('./build/contracts/IWalletCustomLogic.json');
const IWalletFactory = require('./build/contracts/IWalletFactory.json');

// contracts
const CustomSmartWallet = require('./build/contracts/CustomSmartWallet.json');
const CustomSmartWalletDeployVerifier = require('./build/contracts/CustomSmartWalletDeployVerifier.json');
const CustomSmartWalletFactory = require('./build/contracts/CustomSmartWalletFactory.json');
const DeployVerifier = require('./build/contracts/DeployVerifier.json');
const Penalizer = require('./build/contracts/Penalizer.json');
const RelayHub = require('./build/contracts/RelayHub.json');
const RelayVerifier = require('./build/contracts/RelayVerifier.json');
const SmartWallet = require('./build/contracts/SmartWallet.json');
const SmartWalletFactory = require('./build/contracts/SmartWalletFactory.json');
const TestDeployVerifierEverythingAccepted = require('./build/contracts/TestDeployVerifierEverythingAccepted.json');
const TestVerifierEverythingAccepted = require('./build/contracts/TestVerifierEverythingAccepted.json');
const VersionRegistry = require('./build/contracts/VersionRegistry.json');

export {
    // interfaces
    EnvelopingTypes,
    ICustomSmartWalletFactory,
    IDeployVerifier,
    IForwarder,
    IPenalizer,
    IRelayHub,
    IRelayVerifier,
    ISmartWalletFactory,
    ITokenHandler,
    IVersionRegistry,
    IWalletCustomLogic,
    IWalletFactory,
    // contracts
    CustomSmartWallet,
    CustomSmartWalletDeployVerifier,
    CustomSmartWalletFactory,
    DeployVerifier,
    Penalizer,
    RelayHub,
    RelayVerifier,
    SmartWallet,
    SmartWalletFactory,
    TestDeployVerifierEverythingAccepted,
    TestVerifierEverythingAccepted,
    VersionRegistry
}
