// SPDX-License-Identifier:MIT
// solhint-disable no-inline-assembly
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../DestinationContractHandler.sol";
import "../factory/BaseSmartWalletFactory.sol";
import "../smartwallet/FlyoverSmartWallet.sol";
import "../interfaces/IDeployVerifier.sol";
import "../interfaces/EnvelopingTypes.sol";
import "../utils/ContractValidator.sol";
import "../utils/FlyoverUtils.sol";

/**
 * Deploy verifier for Flyover smart wallets that call registerPegIn during initialization.
 * Only native token relay payments are supported. Relay fees are paid via punisher
 * rewards and remaining balance swept to feesReceiver during wallet initialization;
 * tokenAmount and tokenGas must be zero.
 */
contract FlyoverDeployVerifier is IDeployVerifier, DestinationContractHandler {
    address private immutable _factory;

    /// @notice Minimum punisher reward required for a relayed deploy to be accepted.
    /// Set by the owner according to expected relay gas costs on each network.
    uint256 public minPunisherReward;

    event MinPunisherRewardSet(uint256 minPunisherReward);

    constructor(address walletFactory) public {
        _factory = walletFactory;
    }

    function setMinPunisherReward(uint256 minReward) external onlyOwner {
        minPunisherReward = minReward;
        emit MinPunisherRewardSet(minReward);
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
        require(
            relayRequest.request.tokenContract == address(0),
            "ERC20 not supported"
        );
        require(
            relayRequest.request.to != address(0),
            "SW needs a contract execution"
        );
        require(relayRequest.request.value == 0, "Value must be zero");
        require(
            relayRequest.request.tokenAmount == 0,
            "tokenAmount must be zero"
        );
        require(relayRequest.request.tokenGas == 0, "tokenGas must be zero");

        destinationContractValidation(relayRequest.request.to);

        FlyoverSmartWallet walletTemplate = FlyoverSmartWallet(
            payable(BaseSmartWalletFactory(_factory).masterCopy())
        );

        FlyoverUtils.validateRelayEligibility(
            relayRequest.request.data,
            relayRequest.request.to,
            walletTemplate.pegInContract(),
            walletTemplate.collateralManagement(),
            minPunisherReward
        );

        return (
            abi.encode(
                relayRequest.request.tokenAmount,
                relayRequest.request.tokenContract
            )
        );
    }
}
