// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

library BoltzBytesUtil {
    //c3c37fbc  =>  claim(bytes32,uint256,address,uint256)
    bytes4 internal constant _EXTERNAL_SIGNATURE = 0xc3c37fbc;

    //cd413efa  =>  claim(bytes32,uint256,address,address,uint256)
    bytes4 internal constant _PUBLIC_SIGNATURE = 0xcd413efa;

    function validateClaimSignature(bytes memory data) internal pure {
        bytes4 signature = toBytes4(data, 0);

        if (
            signature != _EXTERNAL_SIGNATURE && signature != _PUBLIC_SIGNATURE
        ) {
            revert("Method not allowed");
        }
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
}
