// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../TokenHandler.sol";
import "../DestinationContractHandler.sol";
import "../factory/BoltzSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/BoltzValidator.sol";

/**
 * A Verifier to be used on deploys.
 */
contract BoltzDeployVerifier is
    IDeployVerifier,
    TokenHandler,
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

        uint256 amount = 0;
        if (relayRequest.request.to != address(0)) {
            amount = BoltzValidator.validate(
                relayRequest.request.data,
                relayRequest.request.to,
                contractAddr
            );
        }

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
            require(
                relayRequest.request.tokenAmount <=
                    address(contractAddr).balance + amount,
                "Native balance too low"
            );
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
