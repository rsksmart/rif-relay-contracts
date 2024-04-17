// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../DestinationContractHandler.sol";
import "../factory/MinimalBoltzSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../interfaces/BoltzVerifier.sol";
import "../utils/ContractValidator.sol";
import "../utils/BoltzValidator.sol";

/**
 * A Verifier to be used on deploys.
 */
contract MinimalBoltzDeployVerifier is
    IDeployVerifier,
    DestinationContractHandler
{
    address private immutable _factory;

    constructor(address walletFactory) public {
        _factory = walletFactory;
    }

    function versionVerifier()
        external
        view
        virtual
        override
        returns (string memory)
    {
        return "rif.enveloping.token.iverifier@2.0.1";
    }

    /* solhint-disable no-unused-vars */
    function verifyRelayedCall(
        EnvelopingTypes.DeployRequest calldata relayRequest,
        bytes calldata signature
    ) external virtual override returns (bytes memory context) {
        address contractAddr = ContractValidator.deployValidation(
            relayRequest,
            _factory
        );

        require(
            relayRequest.request.to != address(0),
            "SW needs a contract execution"
        );

        destinationContractValidation(relayRequest.request.to);

        NativeSwap.PublicClaimInfo memory claim = BoltzValidator.validate(
            relayRequest,
            contractAddr
        );

        require(
            relayRequest.request.tokenContract == address(0),
            "RBTC necessary for payment"
        );

        require(
            relayRequest.request.tokenAmount <=
                address(contractAddr).balance + claim.amount,
            "Native balance too low"
        );

        return (
            abi.encode(
                contractAddr,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }
}
