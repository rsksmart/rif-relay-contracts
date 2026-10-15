// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../SwapFeeHandler.sol";
import "../DestinationContractHandler.sol";
import "../factory/BoltzSmartWalletFactory.sol";
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
