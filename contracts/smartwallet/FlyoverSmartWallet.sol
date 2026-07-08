// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseSmartWallet.sol";
import "../interfaces/ICollateralManagement.sol";

/* solhint-disable avoid-low-level-calls */

contract FlyoverSmartWallet is BaseSmartWallet {
    bytes4 private constant _REGISTER_PEGIN_SELECTOR = 0x3823c753;

    address public immutable pegInContract;
    address public immutable collateralManagement;

    event Transfer(address indexed to, uint256 value);

    constructor(address pegInContract_, address collateralManagement_) public {
        require(pegInContract_ != address(0), "Invalid pegIn contract");
        require(
            collateralManagement_ != address(0),
            "Invalid collateral management"
        );
        pegInContract = pegInContract_;
        collateralManagement = collateralManagement_;
    }

    receive() external payable override {
        revert("Not supported");
    }

    function execute(
        bytes32,
        ForwardRequest memory,
        address,
        bytes calldata
    ) external payable virtual override returns (bool, bytes memory) {
        revert("Not supported");
    }

    /**
     * One-shot initialization called by the factory during deployment.
     * Calls registerPegIn on the PegIn contract; the user refund is sent by PegIn
     * to quote.rskRefundAddress. Collateral punisher rewards and any remaining
     * native balance are forwarded to feesReceiver (the relayer).
     * tokenAmount and tokenGas must be zero; relay payment is not done via RIF Relay
     * token fields during initialization.
     * @param owner - The EOA that will own the smart wallet
     * @param tokenContract - Must be address(0)
     * @param feesReceiver - Recipient of punisher rewards and remaining balance
     * @param tokenAmount - Must be 0
     * @param tokenGas - Must be 0
     * @param to - Must be the PegIn contract address
     * @param value - Must be 0
     * @param data - ABI-encoded registerPegIn call data
     */
    function initialize(
        address owner,
        address tokenContract,
        address feesReceiver,
        uint256 tokenAmount,
        uint256 tokenGas,
        address to,
        uint256 value,
        bytes calldata data
    ) external {
        require(getOwner() == bytes32(0), "Already initialized");
        require(tokenContract == address(0), "ERC20 not supported");
        require(value == 0, "Value must be zero");
        require(tokenAmount == 0, "tokenAmount must be zero");
        require(to == pegInContract, "Invalid pegIn target");
        require(tokenGas == 0, "tokenGas must be zero");
        require(data.length >= 4, "Invalid registerPegIn call");
        require(feesReceiver != address(0), "Invalid fees receiver");

        bytes memory callData = data;
        bytes4 selector;
        assembly {
            selector := mload(add(callData, 32))
        }
        require(
            selector == _REGISTER_PEGIN_SELECTOR,
            "Invalid registerPegIn call"
        );

        _setOwner(owner);
        _buildDomainSeparator();

        bool success;
        bytes memory ret;
        (success, ret) = pegInContract.call(callData);
        if (!success) {
            if (ret.length == 0) revert("Unable to register peg in");
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        int256 result = abi.decode(ret, (int256));
        require(result > 0, "Register peg in failed");

        if (
            ICollateralManagement(collateralManagement).getRewards(
                address(this)
            ) > 0
        ) {
            ICollateralManagement(collateralManagement).withdrawRewards(
                payable(feesReceiver)
            );
        }

        uint256 remainingBalance = address(this).balance;
        if (remainingBalance > 0) {
            emit Transfer(feesReceiver, remainingBalance);
            (success, ) = payable(feesReceiver).call{value: remainingBalance}(
                ""
            );
            require(success, "Unable to transfer balance");
        }
    }
}
