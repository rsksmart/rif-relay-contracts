const fs = require('fs');
const truffleConfig = require('../truffle');

// Contracts
const Collector = artifacts.require('Collector');
const TestToken = artifacts.require('TestToken');

module.exports = async function (deployer, network) {
    const multisigSafe = '0xA58bBC3F790F40384fd76372f4Bc576ABAbf6Bd4';

    const relayOperator = '0x7986b3DF570230288501EEa3D890bd66948C9B79';     // accounts[1]
    const walletProvider = '0x0a3aA774752ec2042c46548456c094A76C7F3a79';    // accounts[2] 
    const liquidityProvider = '0xCF7CDBbB5F7BA79d3ffe74A0bBA13FC0295F6036'; // accounts[3] 
    const iovLabsRecipient = '0x39B12C05E8503356E3a7DF0B7B33efA4c054C409';  // accounts[4] 

    const relayOperatorShare = 20;
    const walletProviderShare = 35;
    const liquidityProviderShare = 13;
    const iovLabsRecipientShare = 32;

    const shares = {
        'relayOperator':        { 'beneficiary': relayOperator, 'share': relayOperatorShare}, 
        'walletProvider':       { 'beneficiary': walletProvider, 'share': walletProviderShare}, 
        'liquidityProvider':    { 'beneficiary': liquidityProvider, 'share': liquidityProviderShare}, 
        'iovLabsRecipient':     { 'beneficiary': iovLabsRecipient, 'share': iovLabsRecipientShare}, 
    }
    
    await TestToken.deployed();
    const collectorInstance = await deployer.deploy(Collector, multisigSafe, TestToken.address, shares);

    console.log(
        '|=============================================|=================================================|'
    );
    console.log(
        '| Entity                                      | Address                                         |'
    );
    console.log(
        '|=============================================|=================================================|'
    );
    console.log(`| Multisig Safe address                       | ${multisigSafe}      |`);
    console.log(`| Relay Operator / Safe Owner #1, share       | ${relayOperator}, ${relayOperatorShare}% |`);
    console.log(`| Wallet Provider / Safe Owner #2, share      | ${walletProvider}, ${walletProviderShare}% |`);
    console.log(`| Liquidity Provider / Safe Owner #3, share   | ${liquidityProvider}, ${liquidityProviderShare}% |`);
    console.log(`| IOV Labs Recipient / Safe Owner #4, share   | ${iovLabsRecipient}, ${iovLabsRecipientShare}% |`);
    console.log(`| Collector Contract                          | ${Collector.address}      |`);
    console.log(`| Collector Safe                              | ${await collectorInstance.multisigOwner.call()}      |`);
    console.log(`| Collector Token                             | ${await collectorInstance.token.call()}      |`);
    console.log(
        '|=============================================|=================================================|\n'
    );

    console.log('Generating json config file...');

    const configFileName = 'revenue-sharing-addresses.json';
    let jsonConfig;

    if (fs.existsSync(configFileName)) {
        jsonConfig = JSON.parse(
            fs.readFileSync(configFileName, { encoding: 'UTF-8' })
        );
    } else {
        jsonConfig = {};
    }

    const networkConfiguration = truffleConfig.networks[network];
    const networkId = networkConfiguration.network_id;

    jsonConfig[networkId] = {
        multisigOwner: multisigSafe,
        relayOperator: relayOperator,
        walletProvider: walletProvider,
        liquidityProvider: liquidityProvider,
        iovLabsRecipient: iovLabsRecipient,
        relayOperatorShare: relayOperatorShare,
        walletProviderShare: walletProviderShare,
        liquidityProviderShare: liquidityProviderShare,
        iovLabsRecipientShare: iovLabsRecipientShare,
        collectorContract: Collector.address,
        collectorSafe: await collectorInstance.multisigOwner.call(),
        collectorToken: await collectorInstance.token.call(),
    };

    fs.writeFileSync(configFileName, JSON.stringify(jsonConfig));
};
