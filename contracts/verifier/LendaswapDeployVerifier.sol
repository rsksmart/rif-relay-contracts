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
 * It accepts only an HTLCNative redeem that pays the smart wallet, or no
 * call, on an allowed destination: HTLCNative must be the only one allowed
 * besides address(0).
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

        // No call, or an HTLCNative redeem that pays the smart wallet: no code
        // chosen by the request runs before the wallet pays the fee
        LendaswapUtils.validateCall(
            relayRequest.request.data,
            relayRequest.request.to,
            contractAddr,
            relayRequest.request.value
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
        uint256 /* value, 0 as validateCall requires */
    ) internal view override returns (uint256) {
        return
            payer.balance + LendaswapUtils.quoteRedeemProceeds(data, to, payer);
    }

    function _quoteTokenBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 /* value, 0 as validateCall requires */,
        address token
    ) internal view override returns (uint256) {
        // A redeem pays RBTC only, but the swap must still be active
        LendaswapUtils.quoteRedeemProceeds(data, to, payer);

        return IERC20(token).balanceOf(payer);
    }
}
