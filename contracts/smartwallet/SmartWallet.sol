// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./BaseSmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract SmartWallet is BaseSmartWallet {
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

        if (req.tokenAmount > 0) {
            (success, ret) = req.tokenContract.call{gas: req.tokenGas}(
                abi.encodeWithSelector(
                    hex"a9059cbb", //transfer(address,uint256)
                    feesReceiver,
                    req.tokenAmount
                )
            );

            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to pay for relay"
            );
        }

        //Why this require is not needed: in the case that the EVM implementation
        //sends gasleft() as req.gas  if gasleft() < req.gas (see EIP-1930),  which would end in the call reverting
        //If the relayer made this on purpose in order to collect the payment, since all gasLeft()
        //was sent to this call, then the next line would give an out of gas, and, as a consequence, will
        //revert the whole transaction, and the payment will not happen
        //But it could happen that the destination call makes a gasleft() check and decides to revert if it is
        //not enough, in that case there might be enough gas to complete the relay and the token payment would be collected
        //For that reason, the next require line must be left uncommented, to avoid malicious relayer attacks to destination contract
        //methods that revert if the gasleft() is not enough to execute whatever logic they have.

        require(gasleft() > req.gas, "Not enough gas left");
        (success, ret) = req.to.call{gas: req.gas, value: req.value}(req.data);

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
     * @param tokenAddr - The Token used for payment of the deploy
     * @param tokenRecipient - Recipient of payment
     * @param tokenAmount - Amount to pay
     */

    function initialize(
        address owner,
        address tokenAddr,
        address tokenRecipient,
        uint256 tokenAmount,
        uint256 tokenGas
    ) external {
        require(getOwner() == bytes32(0), "Already initialized");

        _setOwner(owner);

        //we need to initialize the contract
        if (tokenAmount > 0) {
            (bool success, bytes memory ret) = tokenAddr.call{gas: tokenGas}(
                abi.encodeWithSelector(
                    hex"a9059cbb", //transfer(address,uint256)
                    tokenRecipient,
                    tokenAmount
                )
            );

            require(
                success && (ret.length == 0 || abi.decode(ret, (bool))),
                "Unable to pay for deployment"
            );
        }

        _buildDomainSeparator();
    }
}
