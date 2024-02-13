// SPDX-License-Identifier:MIT

pragma solidity ^0.6.12;

import "./Ownable.sol";

abstract contract DestinationContractHandler is Ownable {
    mapping(address => bool) public contracts;
    address[] public acceptedContracts;

    function acceptContract(address destinationContract) external onlyOwner {
        require(
            destinationContract != address(0),
            "Contract cannot be zero address"
        );
        require(
            contracts[destinationContract] == false,
            "Contract is already accepted"
        );
        contracts[destinationContract] = true;
        acceptedContracts.push(destinationContract);
    }

    function removeContract(
        address destinationContract,
        uint256 index
    ) external onlyOwner {
        require(
            destinationContract != address(0),
            "Contract cannot be zero address"
        );
        require(
            contracts[destinationContract] == true,
            "Contract is not accepted"
        );
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
}
