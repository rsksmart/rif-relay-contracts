const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const RevenueSharingAddresses = require('../revenue-sharing-addresses.json');
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
const getTransactionReceipt = async (
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
        const receipt = await web3.eth.getTransactionReceipt(transactionHash);
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (receipt) {
            return receipt;
        }
        await sleep(backoff);
    }
    throw new Error(`No receipt found for this transaction ${transactionHash}`);
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

const safeProxyFactoryAddress = '0xB7a001eE69E7C1eef25Eb8e628e46214Ea74BF0F';
const multiSendAddress = '0x74Dc4471FA8C8fBE09c7a0C400a0852b0A9d04b2';
const safeMasterCopyAddress = '0xe8C7C6f18c3B9532343487faD807060750C1fE95';
const contractNetworks = {
    33: {
        multiSendAddress,
        safeMasterCopyAddress,
        safeProxyFactoryAddress
    }
};

const getPartnerKey = (index) => `partner${index}`;

const getRevenueSharingAddresses = async (web3) => {
    const chainId = await web3.eth.getChainId();
    const networkAddresses = RevenueSharingAddresses[chainId.toString()];
    if (!networkAddresses) {
        throw new Error(
            `The file revenue-sharing-addresses.json doesn't include configuration for network: ${chainId}`
        );
    }
    return networkAddresses;
};

const getPartners = async (web3) => {
    const networkAddresses = await getRevenueSharingAddresses(web3);
    const partners = [];
    // partners are stored with keys having the format "partner1", "partner2", etc...
    let index = 1;
    let partnerKey;
    while ((partnerKey = getPartnerKey(index)) in networkAddresses) {
        const partnerOpts = networkAddresses[partnerKey];
        partners.push(partnerOpts);
        index += 1;
    }
    return partners;
};

const getPartnerAddresses = async (web3) => {
    const partners = await getPartners(web3);
    return partners.map((partner) => partner['address']);
};

module.exports = {
    getTestTokenInstance,
    getCollectorInstance,
    signWithAddress,
    contractNetworks,
    getTransactionReceipt,
    getPartnerAddresses
};
