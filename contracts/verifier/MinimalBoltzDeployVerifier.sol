// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../DestinationContractHandler.sol";
import "../factory/MinimalBoltzSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../interfaces/BoltzVerifier.sol";
import "../utils/ContractValidator.sol";

/**
 * A Verifier to be used on deploys.
 */
contract MinimalBoltzDeployVerifier is
    IDeployVerifier,
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

        address contractAddr = MinimalBoltzSmartWalletFactory(
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
            relayRequest.request.to != address(0),
            "SW needs a contract execution"
        );

        require(
            contracts[relayRequest.request.to],
            "Destination contract not allowed"
        );

        if (relayRequest.request.tokenAmount > 0) {
            require(
                relayRequest.request.tokenContract == address(0),
                "RBTC necessary for payment"
            );

            BoltzTypes.ClaimInfo memory claim = abi.decode(
                relayRequest.request.data[4:],
                (BoltzTypes.ClaimInfo)
            );

            require(
                relayRequest.request.tokenAmount <= claim.amount,
                "Claiming value lower than fees"
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
