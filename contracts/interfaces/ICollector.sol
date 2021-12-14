// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface ICollector{
    struct Participant{
        address payable beneficiary;    // address that will receive a percentage of revenue
        uint share;                     // integer from 0 to 100 representing %
    }

    struct Shares{
        Participant relayOperator;
        Participant walletProvider;
        Participant liquidityProvider;
        Participant iovLabsRecipient;
    }
}
