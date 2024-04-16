// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/EnvelopingTypes.sol";
import "../interfaces/BoltzVerifier.sol";

library BoltzValidator {
    //c3c37fbc  =>  claim(bytes32,uint256,address,uint256)
    bytes4 private constant _EXTERNAL_METHOD = bytes4(keccak256(hex"c3c37fbc"));

    //cd413efa  =>  claim(bytes32,uint256,address,address,uint256)
    bytes4 private constant _PUBLIC_METHOD = bytes4(keccak256(hex"cd413efa"));

    function validate(
        EnvelopingTypes.DeployRequest calldata relayRequest,
        address contractAddr
    ) internal returns (NativeSwap.PublicClaimInfo memory) {
        bytes4 method = bytes4(keccak256(bytes(relayRequest.request.data[:4])));
        NativeSwap.PublicClaimInfo memory claim;

        if (method == _EXTERNAL_METHOD) {
            NativeSwap.ExternalClaimInfo memory localClaim = abi.decode(
                relayRequest.request.data[4:],
                (NativeSwap.ExternalClaimInfo)
            );
            claim = NativeSwap.PublicClaimInfo(
                localClaim.preimage,
                localClaim.amount,
                contractAddr,
                localClaim.refundAddress,
                localClaim.timelock
            );
        } else if (method == _PUBLIC_METHOD) {
            claim = abi.decode(
                relayRequest.request.data[4:],
                (NativeSwap.PublicClaimInfo)
            );
        } else {
            revert("Method not allowed");
        }

        NativeSwap swap = NativeSwap(relayRequest.request.to);

        bytes32 preimageHash = sha256(abi.encodePacked(claim.preimage));

        bytes32 hashValue = swap.hashValues(
            preimageHash,
            claim.amount,
            claim.claimAddress,
            claim.refundAddress,
            claim.timelock
        );

        require(swap.swaps(hashValue), "Verifier: swap has no RBTC");

        return claim;
    }
}
