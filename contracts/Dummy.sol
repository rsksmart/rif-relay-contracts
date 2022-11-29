// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

/* solhint-disable avoid-low-level-calls */
contract Dummy {

   uint256[] private array;
   uint256[] private stressArray = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

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

   function getArrayWithPop(uint256 _remove) external returns (uint256[] memory) {
      for (uint i=0; i < _remove; i++) {
         array.pop();
      }
      return array;
   }

   function stress(uint256 _value) public {
      for (uint i=0; i < _value; i++) {
         stressArray.push(i+stressArray.length);
      }
      delete stressArray;
   }

   function deleteStressArray() public {
      delete stressArray;
   }

   function print(uint8 _value) pure external returns (uint8){
      return _value;
   }

}