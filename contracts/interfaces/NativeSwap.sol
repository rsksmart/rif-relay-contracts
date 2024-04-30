// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface NativeSwap {
    struct PublicClaimInfo {
        bytes32 preimage;
        uint amount;
        address claimAddress;
        address refundAddress;
        uint timelock;
    }

    struct ExternalClaimInfo {
        bytes32 preimage;
        uint amount;
        address refundAddress;
        uint timelock;
    }

    function swaps(bytes32) external returns (bool);

    function hashValues(
        bytes32 preimageHash,
        uint amount,
        address claimAddress,
        address refundAddress,
        uint timelock
    ) external pure returns (bytes32);
}
