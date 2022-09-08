// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '../interfaces/IRelayVerifier.sol';
import '../interfaces/ITokenHandler.sol';

contract TestVerifierEverythingAccepted is IRelayVerifier, ITokenHandler {
    event SampleRecipientPreCall();
    event SampleRecipientPostCall(bool success);

    mapping(address => bool) public tokens;
    address[] public acceptedTokens;

    function versionVerifier()
        external
        view
        virtual
        override
        returns (string memory)
    {
        return '2.0.1+enveloping.test-pea.iverifier';
    }

    function verifyRelayedCall(
        /* solhint-disable-next-line no-unused-vars */
        EnvelopingTypes.RelayRequest calldata relayRequest,
        bytes calldata signature
    ) external virtual override returns (bytes memory) {
        (signature, relayRequest);
        emit SampleRecipientPreCall();
        return ('no revert here');
    }

    function acceptToken(address token) external {
        require(token != address(0), 'Token cannot be zero address');
        require(tokens[token] == false, 'Token is already accepted');
        tokens[token] = true;
        acceptedTokens.push(token);
    }

    function getAcceptedTokens()
        external
        view
        override
        returns (address[] memory)
    {
        return acceptedTokens;
    }

    function acceptsToken(address token) external view override returns (bool) {
        return tokens[token];
    }
}
