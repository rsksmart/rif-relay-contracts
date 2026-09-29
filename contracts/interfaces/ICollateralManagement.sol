// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface ICollateralManagement {
    function getRewards(address addr) external view returns (uint256);

    function getRewardPercentage() external view returns (uint256);

    function withdrawRewards(address payable to) external;
}
