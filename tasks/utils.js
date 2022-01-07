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
    await approveTxResponse.transactionResponse?.wait();
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
    contractNetworks
};