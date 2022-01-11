const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const { Web3Adapter } = safeCoreSdk;

const getTestTokenInstance = async (artifacts) => {
    const TestToken = artifacts.require('TestToken');
    const testTokenInstance = await TestToken.deployed();
    return testTokenInstance;
};

const getCollectorInstance = async (artifacts) => {
    const Collector = artifacts.require('Collector');
    const collectorInstance = await Collector.deployed();
    return collectorInstance;
};

const WAIT_FOR_RECEIPT_RETRIES = 6;
const WAIT_FOR_RECEIPT_INITIAL_BACKOFF = 1000;

const sleep = async (milliseconds) => {
    return await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/**
 * Extracted from rif-relay-common.js, it waits for a transaction receipt to be available or
 * it throws an error after a number of tries.
 * 
 * @param {Web3} web3 Web3.js
 * @param {string} transactionHash transaction hash
 * @param {number} retries number of times to retries
 * @param {number} initialBackoff initial time to wait for. Each time the receipt is not available it will multiplied by 2.
 * @returns 
 */
const getTransactionReceipt= async (
    web3,
    transactionHash,
    retries = WAIT_FOR_RECEIPT_RETRIES,
    initialBackoff = WAIT_FOR_RECEIPT_INITIAL_BACKOFF
) => {
    for (
        let tryCount = 0, backoff = initialBackoff;
        tryCount < retries;
        tryCount++, backoff *= 2
    ) {
        const receipt = await web3.eth.getTransactionReceipt(
            transactionHash
        );
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (receipt) {
            return receipt;
        }
        await sleep(backoff);
    }
    throw new Error(
        `No receipt found for this transaction ${transactionHash}`
    );
};

const signWithAddress = async (web3, safeSdk, safeTransaction, owner) => {
    const ethAdapterOwner = new Web3Adapter({
        web3,
        signerAddress: owner
    });
    const safeSdk2 = await safeSdk.connect({
        ethAdapter: ethAdapterOwner,
        safeAddress: safeSdk.getAddress()
    });
    const txHash = await safeSdk2.getTransactionHash(safeTransaction);
    const approveTxResponse = await safeSdk2.approveTransactionHash(txHash);
    return await getTransactionReceipt(web3, approveTxResponse.hash);
};

const safeProxyFactoryAddress = '0x73ec81da0C72DD112e06c09A6ec03B5544d26F05';
const multiSendAddress = '0x5159345aaB821172e795d56274D0f5FDFdC6aBD9';
const safeMasterCopyAddress = '0x83C5541A6c8D2dBAD642f385d8d06Ca9B6C731ee';
const contractNetworks = {
    '33': {
        multiSendAddress,
        safeMasterCopyAddress,
        safeProxyFactoryAddress
    }
};

module.exports = {
    getTestTokenInstance,
    getCollectorInstance,
    signWithAddress,
    contractNetworks,
    getTransactionReceipt
};