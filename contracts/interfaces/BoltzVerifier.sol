// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface BoltzTypes {
    struct ClaimInfo {
        bytes32 preimage;
        uint amount;
        address refundAddress;
        uint timelock;
    }
}
