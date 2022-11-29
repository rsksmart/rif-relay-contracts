// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.6.12;

/* solhint-disable avoid-low-level-calls */
contract Dummy3 { 

    uint256[] private array;

    function callExternal(address _to, bytes memory _data) public returns (bool success,  bytes memory ret ){
        (success, ret) = _to.call(_data);
    }

    function callExternal(address _to, bytes memory _data, uint256 _value) public returns (bool success,  bytes memory ret ){
        for (uint i=0; i < _value; i++) {
            array.push(i+array.length);
         }
        (success, ret) = _to.call(_data);
    }

    function callExternalRefund(address _to, bytes memory _data, uint256 _value) public returns (bool success,  bytes memory ret ){
        for (uint i=0; i < _value; i++) {
            array.push(i+array.length);
         }
        (success, ret) = _to.call(_data);
        delete array;
    }

}