const fs = require('fs');
const truffleConfig = require('../truffle');

// Contracts
const Collector = artifacts.require('Collector');
const TestToken = artifacts.require('TestToken');

module.exports = async function (deployer, network) {
    const multisigSafe = '0xA58bBC3F790F40384fd76372f4Bc576ABAbf6Bd4';

    const revenueSharingPartners = [
        {'beneficiary': '0x7986b3DF570230288501EEa3D890bd66948C9B79', 'share': 20}, // accounts[1]
        {'beneficiary': '0x0a3aA774752ec2042c46548456c094A76C7F3a79', 'share': 35}, // accounts[2]
        {'beneficiary': '0xCF7CDBbB5F7BA79d3ffe74A0bBA13FC0295F6036', 'share': 13}, // accounts[3] 
        {'beneficiary': '0x39B12C05E8503356E3a7DF0B7B33efA4c054C409', 'share': 32}, // accounts[4]
    ]
    
    await TestToken.deployed();
    const collectorInstance = await deployer.deploy(Collector, multisigSafe, TestToken.address, revenueSharingPartners);

    console.log(
        '|=============================================|==================================================|'
    );
    console.log(
        '| Entity                                      | Address                                          |'
    );
    console.log(
        '|=============================================|==================================================|'
    );
    console.log(`| Multisig Safe address                       | ${multisigSafe}       |`);
    revenueSharingPartners.forEach(function (partner, i) {
        console.log(`| Revenue Partner #${i+1}, share` + " ".repeat(20 - (i+1).toString().length) 
        + `| ${partner.beneficiary}, ${partner.share}%` + " ".repeat(4 - partner.share.toString().length) + `|`);
    });
    console.log(`| Collector Contract                          | ${Collector.address}       |`);
    console.log(`| Collector Owner                             | ${await collectorInstance.owner.call()}       |`);
    console.log(`| Collector Token                             | ${await collectorInstance.token.call()}       |`);
    console.log(
        '|=============================================|==================================================|\n'
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
        collectorContract: Collector.address,
        collectorSafe: await collectorInstance.owner.call(),
        collectorToken: await collectorInstance.token.call(),
    };

    revenueSharingPartners.forEach(function (partner, i) {
        jsonConfig[networkId]["partner" + (i+1)] = partner.beneficiary;
        jsonConfig[networkId]["partner" + (i+1) + "Share"] = partner.share;
    });

    fs.writeFileSync(configFileName, JSON.stringify(jsonConfig));
};
