const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { resolve } = require('path');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { printReceipt, getRevertReason, getTransactionReceipt } = require('./utils');

const defaultPartnerSharesFile = 'partner-shares.json';
const defaultTxGas = 150000;

module.exports = async (callback) => {
    let {
        collectorAddress,
        partnerConfig = defaultPartnerSharesFile,
        txGas = defaultTxGas
    } = argv;
    // check the collector address input parameter
    if (!collectorAddress) {
        const messageError = "Missing '--collectorAddress' parameter";
        console.error(messageError);
        callback(new Error(messageError));
        return;
    }
    // check the partner shares input file
    if (!partnerConfig) {
        console.warn(
            `Missing '--partnerConfig' parameter, ${defaultPartnerSharesFile} will be used`
        );
        partnerConfig = defaultPartnerSharesFile;

        if (!fs.existsSync(partnerConfig)) {
            callback(
                new Error(`Configuration file ${partnerConfig} doesn't exist`)
            );
            return;
        }
    }
    const inputConfig = JSON.parse(
        fs.readFileSync(partnerConfig, { encoding: 'UTF-8' })
    );
    const { partners } = inputConfig;

    const collectorABI = require(resolve('build/contracts/Collector.json')).abi;
    const collector = await new web3.eth.Contract(
        collectorABI,
        collectorAddress
    );
    // the first account (account[0]) will be used to send the transaction
    const accounts = await web3.eth.getAccounts();

    try {
        const tx = await collector.methods
            .updateShares(partners)
            .send({ from: accounts[0], gas: txGas });
        console.log('Transaction Hash', tx.transactionHash);
        const txReceipt = await getTransactionReceipt(
            web3,
            tx.transactionHash
        );
        if (txReceipt) {
            printReceipt(txReceipt);
        }
    } catch (error) {
        const reason = error.hasOwnProperty('receipt')
            ? await getRevertReason(error.receipt.transactionHash)
            : error;
        console.error('Error changing partner shares', reason);
        throw error;
    }

    partners.forEach(function (partner, i) {
        console.log(
            `| Revenue Partner #${i + 1}, share` +
                ' '.repeat(20 - (i + 1).toString().length) +
                `| ${partner.beneficiary}, ${partner.share}%` +
                ' '.repeat(4 - partner.share.toString().length) +
                `|`
        );
    });

    callback();
};
