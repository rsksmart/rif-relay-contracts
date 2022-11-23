// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

contract Dummy {

   
   uint256[] private array;


   function pushToArray(uint256 _value) public {
      array.push(_value);
   }

   function pushArrayToArray(uint256[] memory _array) public {
      for (uint i=0; i < _array.length; i++) {
         array.push(_array[i]);
      }
   }

   function getArray() external view returns (uint256[] memory) {
      return array;
   }

   function getArrayWithPop(uint8 _remove) external returns (uint256[] memory) {
      for (uint i=0; i < _remove; i++) {
         array.pop();
      }
      return array;
   }

}