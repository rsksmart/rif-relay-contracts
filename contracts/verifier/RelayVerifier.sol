// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IWalletFactory.sol";
import "../interfaces/IRelayVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../TokenHandler.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * A verifier for relay transactions.
 */
contract RelayVerifier is IRelayVerifier, TokenHandler {
    using SafeMath for uint256;

    address private _factory;

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
        require(
            tokens[relayRequest.request.tokenContract],
            "Token contract not allowed"
        );

        address payer = relayRequest.relayData.callForwarder;
        if (relayRequest.request.tokenContract != address(0)) {
            require(
                relayRequest.request.tokenAmount <=
                    IERC20(relayRequest.request.tokenContract).balanceOf(payer),
                "balance too low"
            );
        }

        // Check for the codehash of the smart wallet sent
        bytes32 smartWalletCodeHash;
        assembly {
            smartWalletCodeHash := extcodehash(payer)
        }

        require(
            IWalletFactory(_factory).runtimeCodeHash() == smartWalletCodeHash,
            "SW different to template"
        );

        return (
            abi.encode(
                payer,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }

    function nothing() public override returns (uint256) {
        return 3;
    }
}
