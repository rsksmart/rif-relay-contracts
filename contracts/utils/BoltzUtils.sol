// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/NativeSwap.sol";

library BoltzUtils {
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

        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            output := mload(add(add(input, 0x20), offset))
        }

        return output;
    }

    /**
     * @dev Decode the claim data and validate if
     * a swap is stored in the Swap contract.
     * @param data The claim data.
     * @param to The address of the Swap contract.
     * @param contractAddr The claiming address.
     * @return The amount of RBTC to be claimed.
     */
    function validateClaim(
        bytes calldata data,
        address to,
        address contractAddr
    ) internal returns (uint256) {
        bytes4 signature = toBytes4(data, 0);
        /* solhint-disable-next-line no-unused-vars	*/
        NativeSwap.PublicClaimInfo memory claim;

        if (signature == _EXTERNAL_SIGNATURE) {
            NativeSwap.ExternalClaimInfo memory localClaim = abi.decode(
                data[4:],
                (NativeSwap.ExternalClaimInfo)
            );
            claim = NativeSwap.PublicClaimInfo(
                localClaim.preimage,
                localClaim.amount,
                contractAddr,
                localClaim.refundAddress,
                localClaim.timelock
            );
        } else if (signature == _PUBLIC_SIGNATURE) {
            claim = abi.decode(data[4:], (NativeSwap.PublicClaimInfo));
        } else {
            revert("Method not allowed");
        }

        NativeSwap swap = NativeSwap(to);

        bytes32 preimageHash = sha256(abi.encodePacked(claim.preimage));

        bytes32 hashValue = swap.hashValues(
            preimageHash,
            claim.amount,
            claim.claimAddress,
            claim.refundAddress,
            claim.timelock
        );

        require(swap.swaps(hashValue), "Verifier: swap has no RBTC");

        return claim.amount;
    }
}
