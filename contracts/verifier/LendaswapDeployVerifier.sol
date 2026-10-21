// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../SwapFeeHandler.sol";
import "../DestinationContractHandler.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/LendaswapUtils.sol";

/**
 * A Verifier to be used on deploys of the Lendaswap swap smart wallet.
 * It accepts only the HTLCNative redeem methods on an allowed destination.
 */
contract LendaswapDeployVerifier is
    IDeployVerifier,
    SwapFeeHandler,
    DestinationContractHandler
{
    address private immutable _factory;

    constructor(address walletFactory) public {
        require(walletFactory != address(0), "Invalid wallet factory");
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

        // Only the HTLCNative redeems: they pay the smart wallet and run no
        // code chosen by the request before the wallet pays the fee
        require(
            LendaswapUtils.isRedeem(relayRequest.request.data),
            "Method not allowed"
        );

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
        return
            LendaswapUtils.quoteNativeBalanceAfterRedeem(
                data,
                to,
                payer,
                value
            );
    }

    function _quoteTokenBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 value,
        address token
    ) internal view override returns (uint256) {
        return
            LendaswapUtils.quoteTokenBalanceAfterRedeem(
                data,
                to,
                payer,
                value,
                token
            );
    }
}
