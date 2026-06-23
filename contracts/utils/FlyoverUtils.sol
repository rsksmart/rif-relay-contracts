// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/ICollateralManagement.sol";
import "../interfaces/IFlyoverPegIn.sol";

library FlyoverUtils {
    struct PegInQuote {
        uint256 chainId;
        uint256 callFee;
        uint256 penaltyFee;
        uint256 value;
        uint256 gasFee;
        bytes20 fedBtcAddress;
        address lbcAddress;
        address liquidityProviderRskAddress;
        address contractAddress;
        address payable rskRefundAddress;
        int64 nonce;
        uint32 gasLimit;
        uint32 agreementTimestamp;
        uint32 timeForDeposit;
        uint32 callTime;
        uint16 depositConfirmations;
        bool callOnRegister;
        bytes btcRefundAddress;
        bytes liquidityProviderBtcAddress;
        bytes data;
    }

    // 0x3823c753 => registerPegIn((uint256,...),bytes,bytes,bytes,uint256)
    bytes4 internal constant _REGISTER_PEGIN_SELECTOR = 0x3823c753;
    uint256 internal constant _TOTAL_REWARD_PERCENTAGE = 10_000;

    /**
     * @dev Decode and validate a registerPegIn call for Flyover smart wallet deploys.
     * @param data The registerPegIn call data.
     * @param to The destination contract from the deploy request.
     * @param pegInContract The PegIn contract configured in the wallet template.
     */
    function validateRegisterPegIn(
        bytes calldata data,
        address to,
        address pegInContract
    ) internal pure {
        decodeRegisterPegIn(data, to, pegInContract);
    }

    /**
     * @dev Validates that a relayed deploy is eligible: LP penalization applies and
     * the punisher reward covers the configured minimum.
     * Penalization is inferred when the quote is still UNPROCESSED (callForUser was
     * never executed). Deposit timing and paid amount are validated by PegIn at execution.
     * @param minPunisherReward Minimum punisher reward the relayer must receive.
     * @return expectedReward The punisher reward if penalization executes on-chain.
     */
    function validateRelayEligibility(
        bytes calldata data,
        address to,
        address pegInContract,
        address collateralManagement,
        uint256 minPunisherReward
    ) internal view returns (uint256 expectedReward) {
        PegInQuote memory quote;
        (quote, ) = decodeRegisterPegIn(data, to, pegInContract);

        require(quote.penaltyFee > 0, "Penalty fee must be positive");

        bytes32 quoteHash = IFlyoverPegIn(pegInContract).hashPegInQuote(quote);
        require(
            IFlyoverPegIn(pegInContract).getQuoteStatus(quoteHash) ==
                IFlyoverPegIn.PegInStates.UNPROCESSED_QUOTE,
            "Penalization does not apply"
        );

        uint256 rewardPercentage = ICollateralManagement(collateralManagement)
            .getRewardPercentage();
        expectedReward =
            (quote.penaltyFee * rewardPercentage) /
            _TOTAL_REWARD_PERCENTAGE;

        require(expectedReward >= minPunisherReward, "Reward below minimum");
    }

    function decodeRegisterPegIn(
        bytes calldata data,
        address to,
        address pegInContract
    ) internal pure returns (PegInQuote memory quote, uint256 height) {
        require(data.length >= 4, "Invalid registerPegIn call");
        bytes memory dataCopy = data;
        bytes4 selector;
        assembly {
            selector := mload(add(dataCopy, 32))
        }
        require(
            selector == _REGISTER_PEGIN_SELECTOR,
            "Invalid registerPegIn call"
        );
        require(to == pegInContract, "Invalid pegIn target");

        (quote, , , , height) = abi.decode(
            data[4:],
            (PegInQuote, bytes, bytes, bytes, uint256)
        );

        require(quote.lbcAddress == pegInContract, "Invalid quote lbcAddress");
        require(quote.chainId == _getChainID(), "Invalid quote chainId");
    }

    function _getChainID() private pure returns (uint256 id) {
        /* solhint-disable-next-line no-inline-assembly */
        assembly {
            id := chainid()
        }
    }
}
