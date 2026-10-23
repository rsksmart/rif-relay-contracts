// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../SwapFeeHandler.sol";
import "../DestinationContractHandler.sol";
import "../interfaces/IWalletFactory.sol";
import "../interfaces/IRelayVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/LendaswapUtils.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * A verifier for relay transactions of the Lendaswap swap smart wallet.
 * It accepts only an HTLCNative redeem that pays the smart wallet, or no
 * call, on an allowed destination: HTLCNative must be the only one allowed
 * besides address(0).
 */
contract LendaswapRelayVerifier is
    IRelayVerifier,
    SwapFeeHandler,
    DestinationContractHandler
{
    using SafeMath for uint256;

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
        EnvelopingTypes.RelayRequest calldata relayRequest,
        bytes calldata signature
    ) external virtual override returns (bytes memory context) {
        address payer = relayRequest.relayData.callForwarder;

        // Check for the codehash of the smart wallet sent
        bytes32 smartWalletCodeHash = ContractValidator.getCodeHash(payer);

        require(
            IWalletFactory(_factory).runtimeCodeHash() == smartWalletCodeHash,
            "SW different to template"
        );

        destinationContractValidation(relayRequest.request.to);

        // No call, or an HTLCNative redeem that pays the smart wallet: no code
        // chosen by the request runs before the wallet pays the fee
        LendaswapUtils.validateCall(
            relayRequest.request.data,
            relayRequest.request.to,
            payer,
            relayRequest.request.value
        );

        _validateFee(
            relayRequest.request.data,
            relayRequest.request.to,
            payer,
            relayRequest.request.value,
            relayRequest.request.tokenContract,
            relayRequest.request.tokenAmount
        );

        return (
            abi.encode(
                payer,
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
