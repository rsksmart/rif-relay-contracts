// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "../interfaces/ISmartWalletFactory.sol";
import "../interfaces/EnvelopingTypes.sol";

library ContractValidator {
    /**
     * Check if a contract has code in it
     * Should NOT be used in a contructor, it fails
     * See: https://stackoverflow.com/a/54056854
     */
    function isContract(address addr) internal view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(addr)
        }
        return (size > 0);
    }

    function getCodeHash(
        address addr
    ) internal view returns (bytes32 codeHash) {
        assembly {
            codeHash := extcodehash(addr)
        }
    }

    function deployValidation(
        EnvelopingTypes.DeployRequest calldata relayRequest,
        address factory
    ) internal view returns (address) {
        require(
            relayRequest.relayData.callForwarder == factory,
            "Invalid factory"
        );

        address contractAddr = ISmartWalletFactory(
            relayRequest.relayData.callForwarder
        ).getSmartWalletAddress(
                relayRequest.request.from,
                relayRequest.request.recoverer,
                relayRequest.request.index
            );

        require(!isContract(contractAddr), "Address already created");

        return contractAddr;
    }
}
