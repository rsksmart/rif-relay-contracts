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
        EnvelopingTypes.RelayRequest calldata relayRequest,
        bytes calldata signature
    ) external virtual override returns (bytes memory context) {
        revert("Deploy request accepted only");
    }
}
