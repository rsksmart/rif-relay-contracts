// SPDX-License-Identifier:MIT
pragma solidity ^0.6.12;

interface ICollector{
    struct Participant{
        address beneficiary;
        uint share;
    }

    struct Share{
        Participant relayOperator;
        Participant walletProvider;
        Participant liquidityProvider;
        Participant iovLabsRecipient;
    }
}
