// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "./Ownable.sol";
import "./utils/ContractValidator.sol";

abstract contract DestinationContractHandler is Ownable {
    mapping(address => bool) public contracts;

    // Property was included to simplify the process of returning all the accepted contracts,
    // even there are different strategies to reduce the gas cost,
    // it was considered that the accepted contracts are not going to be large.
    address[] public acceptedContracts;

    function acceptContract(address destinationContract) external onlyOwner {
        require(
            destinationContract == address(0) ||
                ContractValidator.isContract(destinationContract),
            "Address is not a contract"
        );
        require(
            !contracts[destinationContract],
            "Contract is already accepted"
        );
        contracts[destinationContract] = true;
        acceptedContracts.push(destinationContract);
    }

    function removeContract(
        address destinationContract,
        uint256 index
    ) external onlyOwner {
        require(contracts[destinationContract], "Contract is not accepted");
        require(
            destinationContract == acceptedContracts[index],
            "Wrong contract index"
        );
        delete contracts[destinationContract];
        acceptedContracts[index] = acceptedContracts[
            acceptedContracts.length - 1
        ];
        acceptedContracts.pop();
    }

    function getAcceptedContracts() external view returns (address[] memory) {
        return acceptedContracts;
    }

    function acceptsContract(
        address destinationContract
    ) external view returns (bool) {
        return contracts[destinationContract];
    }

    function destinationContractValidation(
        address destinationContract
    ) public view {
        require(
            contracts[destinationContract],
            "Destination contract not allowed"
        );
    }
}
