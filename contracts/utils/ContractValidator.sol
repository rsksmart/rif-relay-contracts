// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

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
}
