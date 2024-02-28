// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../TokenHandler.sol";
import "../DestinationContractHandler.sol";
import "../interfaces/IWalletFactory.sol";
import "../interfaces/IRelayVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * A verifier for relay transactions.
 */
contract BoltzRelayVerifier is
    IRelayVerifier,
    TokenHandler,
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

        require(
            contracts[relayRequest.request.to],
            "Destination contract not allowed"
        );

        if (relayRequest.request.tokenAmount > 0) {
            if (relayRequest.request.tokenContract != address(0)) {
                require(
                    tokens[relayRequest.request.tokenContract],
                    "Token contract not allowed"
                );

                require(
                    relayRequest.request.tokenAmount <=
                        IERC20(relayRequest.request.tokenContract).balanceOf(
                            payer
                        ),
                    "Token balance too low"
                );
            } else {
                require(
                    relayRequest.request.tokenAmount <= address(payer).balance,
                    "Native balance too low"
                );
            }
        }

        return (
            abi.encode(
                payer,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }
}
