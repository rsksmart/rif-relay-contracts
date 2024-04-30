// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../DestinationContractHandler.sol";
import "../factory/MinimalBoltzSmartWalletFactory.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/BoltzBytesUtil.sol";
import "../interfaces/NativeSwap.sol";

/**
 * A Verifier to be used on deploys.
 */
contract MinimalBoltzDeployVerifier is
    IDeployVerifier,
    DestinationContractHandler
{
    address private immutable _factory;

    constructor(address walletFactory) public {
        _factory = walletFactory;
    }

    function versionVerifier()
        external
        view
        virtual
        override
        returns (string memory)
    {
        return "rif.enveloping.token.iverifier@2.0.1";
    }

    /* solhint-disable no-unused-vars */
    function verifyRelayedCall(
        EnvelopingTypes.DeployRequest calldata relayRequest,
        bytes calldata signature
    ) external virtual override returns (bytes memory context) {
        address contractAddr = ContractValidator.deployValidation(
            relayRequest,
            _factory
        );

        require(
            relayRequest.request.to != address(0),
            "SW needs a contract execution"
        );

        destinationContractValidation(relayRequest.request.to);

        uint256 amount = _validateClaim(
            relayRequest.request.data,
            relayRequest.request.to,
            contractAddr
        );

        require(
            relayRequest.request.tokenContract == address(0),
            "RBTC necessary for payment"
        );

        require(
            relayRequest.request.tokenAmount <=
                address(contractAddr).balance + amount,
            "Native balance too low"
        );

        return (
            abi.encode(
                contractAddr,
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }

    function _validateClaim(
        bytes calldata data,
        address to,
        address contractAddr
    ) private returns (uint256) {
        bytes4 signature = BoltzBytesUtil.toBytes4(data, 0);
        NativeSwap.PublicClaimInfo memory claim;

        if (signature == BoltzBytesUtil._EXTERNAL_SIGNATURE) {
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
        } else if (signature == BoltzBytesUtil._PUBLIC_SIGNATURE) {
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
