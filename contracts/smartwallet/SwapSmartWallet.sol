// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseSmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SwapSmartWallet is BaseSmartWallet {
    function execute(
        bytes32 suffixData,
        ForwardRequest memory req,
        address feesReceiver,
        bytes calldata sig
    )
        external
        payable
        virtual
        override
        returns (bool success, bytes memory ret)
    {
        (sig);
        require(msg.sender == req.relayHub, "Invalid caller");

        _verifySig(suffixData, req, sig);
        require(
            req.validUntilTime == 0 || req.validUntilTime > block.timestamp,
            "SW: request expired"
        );
        nonce++;

        bool paid = _payFeeBeforeCall(
            req.tokenContract,
            feesReceiver,
            req.tokenAmount,
            req.tokenGas,
            req.value,
            "Unable to pay for relay"
        );

        (success, ret) = req.to.call{gas: req.gas, value: req.value}(req.data);

        if (!paid) {
            _payFee(
                req.tokenContract,
                feesReceiver,
                req.tokenAmount,
                req.tokenGas,
                "Unable to pay for relay"
            );
        }

        //If any balance has been added then trasfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(req.from).transfer(address(this).balance);
        }
    }

    /**
     * This Proxy will first charge for the deployment and then it will pass the
     * initialization scope to the wallet logic.
     * This function can only be called once, and it is called by the Factory during deployment
     * @param owner - The EOA that will own the smart wallet
     * @param tokenContract - Token used for payment of the deploy
     * @param feesReceiver - Recipient of payment
     * @param tokenAmount - Amount to pay
     * @param tokenGas - Gas limit of payment
     * @param to - Destination contract to execute
     * @param value - Value to send to destination contract
     * @param data - Data to be execute by destination contract
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

        _setOwner(owner);

        bool paid = _payFeeBeforeCall(
            tokenContract,
            feesReceiver,
            tokenAmount,
            tokenGas,
            value,
            "Unable to pay for deployment"
        );

        // Although this check isn't strictly necessary, it's included to improve the transaction estimation
        if (to != address(0)) {
            (bool success, bytes memory ret) = to.call{value: value}(data);
            if (!success) {
                if (ret.length == 0) revert("Unable to execute");
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }

        if (!paid) {
            _payFee(
                tokenContract,
                feesReceiver,
                tokenAmount,
                tokenGas,
                "Unable to pay for deployment"
            );
        }

        _buildDomainSeparator();

        //If any balance has been added then trasfer it to the owner EOA
        if (address(this).balance > 0) {
            //can't fail: req.from signed (off-chain) the request, so it must be an EOA...
            payable(owner).transfer(address(this).balance);
        }
    }

    /**
     * @dev Pays the fee before the call when the wallet already holds it, so
     * nothing the call runs can spend it: always for a token, which never
     * comes from the call, and for RBTC when the balance covers the fee on
     * top of the value the call forwards. A fee the call itself brings in
     * (the claim of a swap into an empty wallet) is paid after the call.
     * @return Whether the fee is settled.
     */
    function _payFeeBeforeCall(
        address tokenContract,
        address feesReceiver,
        uint256 tokenAmount,
        uint256 tokenGas,
        uint256 value,
        string memory errorMessage
    ) private returns (bool) {
        if (tokenAmount == 0) {
            return true;
        }

        if (tokenContract == address(0)) {
            uint256 balance = address(this).balance;
            if (balance < value || balance - value < tokenAmount) {
                return false;
            }
        }

        _payFee(
            tokenContract,
            feesReceiver,
            tokenAmount,
            tokenGas,
            errorMessage
        );

        return true;
    }

    function _payFee(
        address tokenContract,
        address feesReceiver,
        uint256 tokenAmount,
        uint256 tokenGas,
        string memory errorMessage
    ) private {
        bool success;
        bytes memory ret;
        if (tokenContract == address(0)) {
            (success, ret) = payable(feesReceiver).call{
                value: tokenAmount,
                gas: tokenGas
            }("");
        } else {
            (success, ret) = tokenContract.call{gas: tokenGas}(
                abi.encodeWithSelector(
                    hex"a9059cbb", // transfer(address,uint256)
                    feesReceiver,
                    tokenAmount
                )
            );
        }
        require(
            success && (ret.length == 0 || abi.decode(ret, (bool))),
            errorMessage
        );
    }
}
