// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../SwapFeeHandler.sol";
import "../DestinationContractHandler.sol";
import "../interfaces/IWalletFactory.sol";
import "../interfaces/IRelayVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/BoltzUtils.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * A verifier for relay transactions.
 */
contract BoltzRelayVerifier is
    IRelayVerifier,
    SwapFeeHandler,
    DestinationContractHandler
{
    using SafeMath for uint256;

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
        uint256 value
    ) internal view override returns (uint256) {
        uint256 proceeds = BoltzUtils.quoteClaimProceeds(
            data,
            to,
            payer,
            value
        );

        // The wallet forwards value before paying the fee
        uint256 balance = payer.balance;
        require(value <= balance, "Native balance too low");

        return balance - value + proceeds;
    }

    function _quoteTokenBalance(
        bytes calldata data,
        address to,
        address payer,
        uint256 value,
        address token
    ) internal view override returns (uint256) {
        // A claim the wallet cannot execute is refused whatever pays the fee;
        // the RBTC it pays out is irrelevant to a token fee.
        // slither-disable-next-line unused-return
        BoltzUtils.quoteClaimProceeds(data, to, payer, value);

        return IERC20(token).balanceOf(payer);
    }
}
