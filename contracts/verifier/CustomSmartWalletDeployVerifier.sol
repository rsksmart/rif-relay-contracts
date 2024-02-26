// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../TokenHandler.sol";
import "../factory/CustomSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";

/**
 * A Verifier to be used on deploys.
 */
contract CustomSmartWalletDeployVerifier is IDeployVerifier, TokenHandler {
    address private immutable _FACTORY;

    constructor(address walletFactory) public {
        _FACTORY = walletFactory;
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
        require(
            tokens[relayRequest.request.tokenContract],
            "Token contract not allowed"
        );
        require(
            relayRequest.relayData.callForwarder == _FACTORY,
            "Invalid factory"
        );

        address contractAddr = CustomSmartWalletFactory(
            relayRequest.relayData.callForwarder
        ).getSmartWalletAddress(
                relayRequest.request.from,
                relayRequest.request.recoverer,
                relayRequest.request.to,
                keccak256(relayRequest.request.data),
                relayRequest.request.index
            );

        require(
            !ContractValidator.isContract(contractAddr),
            "Address already created"
        );

        if (relayRequest.request.tokenContract != address(0)) {
            require(
                relayRequest.request.tokenAmount <=
                    IERC20(relayRequest.request.tokenContract).balanceOf(
                        contractAddr
                    ),
                "balance too low"
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
