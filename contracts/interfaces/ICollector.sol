// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface ICollector{
    struct Participant{
        address payable beneficiary;
        uint share;
    }

    struct Shares{
        Participant relayOperator;
        Participant walletProvider;
        Participant liquidityProvider;
        Participant iovLabsRecipient;
    }
}
