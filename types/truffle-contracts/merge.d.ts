/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

/// <reference types="@openeth/truffle-typings" />

import * as TruffleContracts from ".";

declare global {
  namespace Truffle {
    interface Artifacts {
      require(name: "BasicToken"): TruffleContracts.BasicTokenContract;
      require(name: "BlackList"): TruffleContracts.BlackListContract;
      require(name: "Collector"): TruffleContracts.CollectorContract;
      require(
        name: "CustomSmartWallet"
      ): TruffleContracts.CustomSmartWalletContract;
      require(
        name: "CustomSmartWalletDeployVerifier"
      ): TruffleContracts.CustomSmartWalletDeployVerifierContract;
      require(
        name: "CustomSmartWalletFactory"
      ): TruffleContracts.CustomSmartWalletFactoryContract;
      require(name: "DeployVerifier"): TruffleContracts.DeployVerifierContract;
      require(name: "Dummy"): TruffleContracts.DummyContract;
      require(name: "Dummy2"): TruffleContracts.Dummy2Contract;
      require(name: "Dummy3"): TruffleContracts.Dummy3Contract;
      require(name: "ERC20"): TruffleContracts.ERC20Contract;
      require(name: "ERC20Basic"): TruffleContracts.ERC20BasicContract;
      require(name: "ERC20Mod"): TruffleContracts.ERC20ModContract;
      require(
        name: "FailureCustomLogic"
      ): TruffleContracts.FailureCustomLogicContract;
      require(name: "HeavyTask"): TruffleContracts.HeavyTaskContract;
      require(name: "ICollector"): TruffleContracts.ICollectorContract;
      require(
        name: "ICustomSmartWalletFactory"
      ): TruffleContracts.ICustomSmartWalletFactoryContract;
      require(
        name: "IDeployVerifier"
      ): TruffleContracts.IDeployVerifierContract;
      require(name: "IERC20"): TruffleContracts.IERC20Contract;
      require(name: "IForwarder"): TruffleContracts.IForwarderContract;
      require(name: "IPenalizer"): TruffleContracts.IPenalizerContract;
      require(name: "IRelayHub"): TruffleContracts.IRelayHubContract;
      require(name: "IRelayVerifier"): TruffleContracts.IRelayVerifierContract;
      require(
        name: "ISmartWalletFactory"
      ): TruffleContracts.ISmartWalletFactoryContract;
      require(name: "ITokenHandler"): TruffleContracts.ITokenHandlerContract;
      require(
        name: "IVersionRegistry"
      ): TruffleContracts.IVersionRegistryContract;
      require(
        name: "IWalletCustomLogic"
      ): TruffleContracts.IWalletCustomLogicContract;
      require(name: "IWalletFactory"): TruffleContracts.IWalletFactoryContract;
      require(name: "Migrations"): TruffleContracts.MigrationsContract;
      require(
        name: "NonCompliantERC20"
      ): TruffleContracts.NonCompliantERC20Contract;
      require(
        name: "NonCompliantIERC20"
      ): TruffleContracts.NonCompliantIERC20Contract;
      require(
        name: "NonCompliantTestToken"
      ): TruffleContracts.NonCompliantTestTokenContract;
      require(
        name: "NonRevertTestToken"
      ): TruffleContracts.NonRevertTestTokenContract;
      require(name: "Ownable"): TruffleContracts.OwnableContract;
      require(name: "Pausable"): TruffleContracts.PausableContract;
      require(
        name: "PayableWithEmit"
      ): TruffleContracts.PayableWithEmitContract;
      require(name: "Penalizer"): TruffleContracts.PenalizerContract;
      require(
        name: "ProxyCustomLogic"
      ): TruffleContracts.ProxyCustomLogicContract;
      require(name: "RelayHub"): TruffleContracts.RelayHubContract;
      require(name: "RelayVerifier"): TruffleContracts.RelayVerifierContract;
      require(name: "SmartWallet"): TruffleContracts.SmartWalletContract;
      require(
        name: "SmartWalletFactory"
      ): TruffleContracts.SmartWalletFactoryContract;
      require(name: "StandardToken"): TruffleContracts.StandardTokenContract;
      require(
        name: "SuccessCustomLogic"
      ): TruffleContracts.SuccessCustomLogicContract;
      require(
        name: "TestDeployVerifier"
      ): TruffleContracts.TestDeployVerifierContract;
      require(
        name: "TestDeployVerifierConfigurableMisbehavior"
      ): TruffleContracts.TestDeployVerifierConfigurableMisbehaviorContract;
      require(
        name: "TestDeployVerifierEverythingAccepted"
      ): TruffleContracts.TestDeployVerifierEverythingAcceptedContract;
      require(
        name: "TestForwarderTarget"
      ): TruffleContracts.TestForwarderTargetContract;
      require(name: "TestRecipient"): TruffleContracts.TestRecipientContract;
      require(
        name: "TestRelayVerifier"
      ): TruffleContracts.TestRelayVerifierContract;
      require(
        name: "TestRelayWorkerContract"
      ): TruffleContracts.TestRelayWorkerContractContract;
      require(
        name: "TestRSKAddressValidator"
      ): TruffleContracts.TestRSKAddressValidatorContract;
      require(
        name: "TestSmartWallet"
      ): TruffleContracts.TestSmartWalletContract;
      require(name: "TestToken"): TruffleContracts.TestTokenContract;
      require(name: "TestUtil"): TruffleContracts.TestUtilContract;
      require(
        name: "TestVerifierConfigurableMisbehavior"
      ): TruffleContracts.TestVerifierConfigurableMisbehaviorContract;
      require(
        name: "TestVerifierEverythingAccepted"
      ): TruffleContracts.TestVerifierEverythingAcceptedContract;
      require(
        name: "TestVerifierVariableGasLimits"
      ): TruffleContracts.TestVerifierVariableGasLimitsContract;
      require(name: "TestVersions"): TruffleContracts.TestVersionsContract;
      require(name: "TetherToken"): TruffleContracts.TetherTokenContract;
      require(
        name: "UpgradedStandardToken"
      ): TruffleContracts.UpgradedStandardTokenContract;
      require(
        name: "VersionRegistry"
      ): TruffleContracts.VersionRegistryContract;
    }
  }
}
