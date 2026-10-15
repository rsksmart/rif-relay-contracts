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
        require(isClaim(data), "Method not allowed");
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
     * @dev Whether the data calls one of the EtherSwap claim methods.
     */
    function isClaim(bytes memory data) internal pure returns (bool) {
        if (data.length < 4) {
            return false;
        }

        bytes4 signature = toBytes4(data, 0);

        return
            signature == _EXTERNAL_SIGNATURE || signature == _PUBLIC_SIGNATURE;
    }

    /**
     * @dev Decode the claim data and validate that a swap is stored in the
     * Swap contract. Reverts if the data is not a claim.
     * @param data The claim data.
     * @param to The address of the Swap contract.
     * @param contractAddr The claiming address.
     * @param value The request's value. The full wallet forwards it and both
     * claim methods are nonpayable; the minimal wallet never sends it.
     * Either way it must be zero.
     * @return The RBTC the claiming address receives: the amount when it is
     * the claim address, otherwise 0.
     */
    function validateClaim(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        require(isClaim(data), "Method not allowed");

        return _quoteClaim(data, to, contractAddr, value);
    }

    /**
     * @dev The RBTC the smart wallet receives from the call: the claim amount
     * when the data claims a funded swap with the wallet as claim address,
     * 0 for any other call. A claim the wallet cannot execute (unfunded swap,
     * value on the nonpayable claim) reverts.
     * @param data The call data.
     * @param to The destination contract.
     * @param contractAddr The smart wallet executing the call.
     * @param value The RBTC the smart wallet forwards with the call.
     */
    function quoteClaimProceeds(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) internal view returns (uint256) {
        if (!isClaim(data)) {
            return 0;
        }

        return _quoteClaim(data, to, contractAddr, value);
    }

    function _quoteClaim(
        bytes calldata data,
        address to,
        address contractAddr,
        uint256 value
    ) private view returns (uint256) {
        require(value == 0, "Value not allowed");

        bytes4 signature = toBytes4(data, 0);
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
        } else {
            claim = abi.decode(data[4:], (NativeSwap.PublicClaimInfo));
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

        // EtherSwap pays claimAddress, so the wallet only receives the
        // amount when it is the claim address.
        return claim.claimAddress == contractAddr ? claim.amount : 0;
    }
}
