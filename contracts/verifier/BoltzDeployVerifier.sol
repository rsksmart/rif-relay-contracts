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
import "../interfaces/BoltzVerifier.sol";
import "../utils/ContractValidator.sol";

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
        require(
            relayRequest.relayData.callForwarder == _factory,
            "Invalid factory"
        );

        address contractAddr = BoltzSmartWalletFactory(
            relayRequest.relayData.callForwarder
        ).getSmartWalletAddress(
                relayRequest.request.from,
                relayRequest.request.recoverer,
                relayRequest.request.index
            );

        require(
            !ContractValidator.isContract(contractAddr),
            "Address already created"
        );

        require(
            relayRequest.request.to == address(0) ||
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
                            contractAddr
                        ),
                    "Token balance too low"
                );
            } else {
                if (relayRequest.request.to != address(0)) {
                    BoltzTypes.ClaimInfo memory claim = abi.decode(
                        relayRequest.request.data[4:],
                        (BoltzTypes.ClaimInfo)
                    );

                    require(
                        relayRequest.request.tokenAmount <= claim.amount,
                        "Claiming value lower than fees"
                    );
                } else {
                    require(
                        relayRequest.request.tokenAmount <=
                            address(contractAddr).balance,
                        "Native balance too low"
                    );
                }
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
