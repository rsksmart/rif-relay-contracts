// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./SmartWallet.sol";

/* solhint-disable no-inline-assembly */
/* solhint-disable avoid-low-level-calls */

contract NativeHolderSmartWallet is SmartWallet {
    
     /* solhint-disable no-unused-vars */
    function directExecute(
        address to,
        bytes calldata data
    ) external payable override returns (bool success, bytes memory ret) {
        revert("Method not implemented");
    }

    function directExecute(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bool success, bytes memory ret) {
        //Verify Owner
        require(
            getOwner() == keccak256(abi.encodePacked(msg.sender)),
            "Not the owner of the SmartWallet"
        );

        (success, ret) = to.call{ value: value }(data);
    }

    function execute(
        bytes32 suffixData,
        ForwardRequest memory req,
        address feesReceiver,
        bytes calldata sig
    ) external payable override returns (bool success, bytes memory ret) {
        (sig);
        require(msg.sender == req.relayHub, "Invalid caller");

        _verifySig(suffixData, req, sig);
        // solhint-disable-next-line not-rely-on-time
        require(req.validUntilTime == 0 || req.validUntilTime > block.timestamp, "SW: request expired");
        nonce++;

        if (req.tokenAmount > 0) {
            (success, ret) = req.tokenContract.call{ gas: req.tokenGas }(
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
        (success, ret) = req.to.call{ gas: req.gas, value: req.value }(
            req.data
        );
    }
}
