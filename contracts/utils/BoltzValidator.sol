// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

import "../interfaces/EnvelopingTypes.sol";
import "../interfaces/NativeSwap.sol";

library BoltzValidator {
    //c3c37fbc  =>  claim(bytes32,uint256,address,uint256)
    bytes4 private constant _EXTERNAL_SIGNATURE = 0xc3c37fbc;

    //cd413efa  =>  claim(bytes32,uint256,address,address,uint256)
    bytes4 private constant _PUBLIC_SIGNATURE = 0xcd413efa;

    function validateSignature(bytes memory data) internal pure {
        bytes4 signature = toBytes4(data, 0);

        if (
            signature != _EXTERNAL_SIGNATURE && signature != _PUBLIC_SIGNATURE
        ) {
            revert("Signature not allowed");
        }
    }

    function validate(
        bytes calldata data,
        address to,
        address contractAddr
    ) internal returns (uint256) {
        bytes4 signature = toBytes4(data, 0);
        bytes32 preimage = toBytes32(data, 4);
        uint256 amount = uint256(toBytes32(data, 36));
        address claimAddress;
        address refundAddress;
        uint256 timelock;

        if (signature == _EXTERNAL_SIGNATURE) {
            claimAddress = contractAddr;
            refundAddress = toAddress(data, 80);
            timelock = uint256(toBytes32(data, 100));
        } else if (signature == _PUBLIC_SIGNATURE) {
            claimAddress = toAddress(data, 80);
            refundAddress = toAddress(data, 112);
            timelock = uint256(toBytes32(data, 132));
        } else {
            revert("Signature not allowed");
        }

        NativeSwap swap = NativeSwap(to);

        bytes32 preimageHash = sha256(abi.encodePacked(preimage));

        bytes32 hashValue = swap.hashValues(
            preimageHash,
            amount,
            claimAddress,
            refundAddress,
            timelock
        );

        require(swap.swaps(hashValue), "Verifier: swap has no RBTC");

        return amount;
    }

    function toAddress(
        bytes memory input,
        uint256 offset
    ) internal pure returns (address) {
        bytes20 output;

        assembly {
            output := mload(add(add(input, 0x20), offset))
        }

        return address(output);
    }

    function toBytes4(
        bytes memory input,
        uint256 offset
    ) internal pure returns (bytes4) {
        bytes4 output;

        assembly {
            output := mload(add(add(input, 0x20), offset))
        }

        return output;
    }

    function toBytes32(
        bytes memory input,
        uint256 offset
    ) internal pure returns (bytes32) {
        bytes32 output;

        assembly {
            output := mload(add(add(input, 0x20), offset))
        }

        return output;
    }
}
