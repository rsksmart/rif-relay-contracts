// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./IWalletFactory.sol";

interface ISmartWalletRelayer is IWalletFactory {
    function relayedUserSmartWalletCreation(
        IForwarder.DeployRequest memory req,
        bytes32 suffixData,
        address feesReceiver,
        bytes calldata sig
    ) external;
}
