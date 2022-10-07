// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface ICollector{
    struct RevenuePartner{
        address payable beneficiary;    // address that will receive a percentage of revenue
        uint8 share;                     // integer from 0 to 100 representing %
    }

    function withdraw() external; 

    function transferOwnership(address _owner) external;
}
