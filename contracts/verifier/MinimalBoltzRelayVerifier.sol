// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IWalletFactory.sol";
import "../interfaces/IRelayVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

/**
 * A verifier for relay transactions.
 */
contract MinimalBoltzRelayVerifier is IRelayVerifier {
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
        address payer = relayRequest.relayData.callForwarder;

        // Check for the codehash of the smart wallet sent
        bytes32 smartWalletCodeHash;
        assembly {
            smartWalletCodeHash := extcodehash(payer)
        }

        require(
            IWalletFactory(_factory).runtimeCodeHash() == smartWalletCodeHash,
            "SW different to template"
        );

        revert("Deploy request accepted only");
    }
}
