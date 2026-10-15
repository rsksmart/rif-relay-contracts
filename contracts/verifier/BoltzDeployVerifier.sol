// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../SwapFeeHandler.sol";
import "../DestinationContractHandler.sol";
import "../factory/SwapSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/BoltzUtils.sol";

/**
 * A Verifier to be used on deploys.
 */
contract BoltzDeployVerifier is
    IDeployVerifier,
    SwapFeeHandler,
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

        destinationContractValidation(relayRequest.request.to);

        // Both claim methods are nonpayable and initialize bubbles the failed
        // claim, whatever pays the fee
        require(relayRequest.request.value == 0, "Value not allowed");

        _validateFee(
            relayRequest.request.data,
            relayRequest.request.to,
            contractAddr,
            relayRequest.request.value,
            relayRequest.request.tokenContract,
            relayRequest.request.tokenAmount
        );

        return (
            abi.encode(
                contractAddr,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }

    function _quoteNativeBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 value
    ) internal view override returns (uint256) {
        return payer.balance + BoltzUtils.validateClaim(data, to, payer, value);
    }
}
