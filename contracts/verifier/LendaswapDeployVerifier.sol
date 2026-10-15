// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../TokenHandler.sol";
import "../DestinationContractHandler.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/LendaswapUtils.sol";

/**
 * A Verifier to be used on deploys.
 */
contract LendaswapDeployVerifier is
    IDeployVerifier,
    TokenHandler,
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

        if (relayRequest.request.tokenAmount > 0) {
            if (relayRequest.request.tokenContract != address(0)) {
                require(
                    tokens[relayRequest.request.tokenContract],
                    "Token contract not allowed"
                );

                require(
                    relayRequest.request.tokenAmount <=
                        IERC20(relayRequest.request.tokenContract).balanceOf(
                            contractAddr
                        ),
                    "Token balance too low"
                );
            } else {
                uint256 amount = LendaswapUtils.validateRedeem(
                    relayRequest.request.data,
                    relayRequest.request.to,
                    contractAddr,
                    relayRequest.request.value
                );

                // The wallet forwards request.value before paying the fee
                uint256 balance = address(contractAddr).balance;
                require(
                    relayRequest.request.value <= balance,
                    "Native balance too low"
                );
                require(
                    relayRequest.request.tokenAmount <=
                        balance - relayRequest.request.value + amount,
                    "Native balance too low"
                );
            }
        }

        return (
            abi.encode(
                contractAddr,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }
}
