const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;

const defaultConfigFileName = 'deploy-collector.input.json';
const defaultOutputFileName = 'revenue-sharing-addresses.json';
// Contracts
const Collector = artifacts.require('Collector');

module.exports = async (callback) => {
    let { collectorConfig, outputFile = defaultOutputFileName } = argv;
    if (!collectorConfig) {
        console.warn(
            "Missing '--collectorConfig' parameter, 'deploy-collector.input.json' will be used"
        );
        collectorConfig = defaultConfigFileName;
    }

    if (!fs.existsSync(collectorConfig)) {
        callback(
            new Error(`Configuration file ${collectorConfig} doesn't exist`)
        );
        return;
    }
    const inputConfig = JSON.parse(
        fs.readFileSync(collectorConfig, { encoding: 'UTF-8' })
    );

    const {
        collectorOwner,
        partners: revenueSharingPartners,
        tokenAddress,
        remainderAddress
    } = inputConfig;
    const collectorInstance = await Collector.new(
        collectorOwner,
        tokenAddress,
        revenueSharingPartners,
        remainderAddress
    );
    const deploymentReceipt = await web3.eth.getTransactionReceipt(
        collectorInstance.transactionHash
    );
    printReceipt(deploymentReceipt);

    console.log();

    console.log(
        '|=============================================|==================================================|'
    );
    console.log(
        '| Entity                                      | Address                                          |'
    );
    console.log(
        '|=============================================|==================================================|'
    );
    revenueSharingPartners.forEach(function (partner, i) {
        console.log(
            `| Revenue Partner #${i + 1}, share` +
                ' '.repeat(20 - (i + 1).toString().length) +
                `| ${partner.beneficiary}, ${partner.share}%` +
                ' '.repeat(4 - partner.share.toString().length) +
                `|`
        );
    });
    console.log(
        `| Collector Contract                          | ${collectorInstance.address}       |`
    );
    console.log(
        `| Collector Owner                             | ${await collectorInstance.owner.call()}       |`
    );
    console.log(
        `| Collector Token                             | ${await collectorInstance.token.call()}       |`
    );
    console.log(
        `| Collector Remainder                         | ${remainderAddress}       |`
    );
    console.log(
        '|=============================================|==================================================|\n'
    );

    console.log('Generating json config file...');

    let jsonConfig;

    if (fs.existsSync(outputFile)) {
        jsonConfig = JSON.parse(
            fs.readFileSync(outputFile, { encoding: 'UTF-8' })
        );
    } else {
        jsonConfig = {};
    }

    const networkId = await web3.eth.getChainId();

    jsonConfig[networkId] = {
        collectorContract: collectorInstance.address,
        collectorOwner: await collectorInstance.owner.call(),
        collectorToken: await collectorInstance.token.call(),
        remainderAddress: remainderAddress
    };

    revenueSharingPartners.forEach(function (partner, i) {
        jsonConfig[networkId]['partner' + (i + 1)] = {
            address: partner.beneficiary,
            share: partner.share
        };
    });

    fs.writeFileSync(outputFile, JSON.stringify(jsonConfig));
    callback();
};

function printReceipt(txReceipt) {
    const printLine = () => console.log('-'.repeat(98));

    console.log('Transaction Receipt');
    printLine();

    const fieldsToPrint = ['transactionHash', 'from', 'blockNumber', 'gasUsed'];
    fieldsToPrint.forEach((field) => {
        console.log(
            `> ${field} ` +
                `${' '.repeat(20 - field.length)}` +
                `| ${txReceipt[field]} ` +
                `${' '.repeat(70 - txReceipt[field].toString().length)} |`
        );
    });
    printLine();
    console.log();
}
