const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
    getTestTokenInstance,
    getCollectorInstance,
    signWithAddress,
    contractNetworks,
    getTransactionReceipt,
    getPartnerAddresses
} = require('./utils');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { default: Safe, Web3Adapter } = safeCoreSdk;

const printStatus = async (collectorAddress, owners, testTokenInstance) => {
    const collectorBalance = await testTokenInstance.balanceOf(
        collectorAddress
    );
    console.log(`Collector balance: ${collectorBalance}`);
    for (const owner of owners) {
        const balance = await testTokenInstance.balanceOf(owner);
        console.log(`Address ${owner} balance: ${balance}`);
    }
};

module.exports = async (callback) => {
    const owners = await getPartnerAddresses(web3);

    const { safeAddress } = argv;
    if (!web3.utils.isAddress(safeAddress)) {
        callback(new Error(`invalid "safeAddress": ${safeAddress}`));
    }
    const collectorInstance = await getCollectorInstance(artifacts);
    const collectorAddress = collectorInstance.address;

    // print the initial status
    const safeBalance = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance', web3.utils.fromWei(safeBalance));
    const testTokenInstance = await getTestTokenInstance(artifacts);

    console.log('---Token balance before---');
    await printStatus(collectorAddress, owners, testTokenInstance);

    const ethAdapterOwner1 = new Web3Adapter({
        web3,
        signerAddress: owners[0]
    });
    const safeSdk = await Safe.create({
        ethAdapter: ethAdapterOwner1,
        safeAddress,
        contractNetworks
    });

    const encodedWithdrawFunction = web3.eth.abi.encodeFunctionCall(
        {
            name: 'withdraw',
            type: 'function',
            inputs: []
        },
        []
    );

    const transactions = [
        {
            to: collectorAddress,
            value: 0,
            data: encodedWithdrawFunction
        }
    ];
    const safeTransaction = await safeSdk.createTransaction(...transactions);

    // All the owners but the first one will sign the transaction before,
    // while the owners[0] will sign the transaction on execution.
    for (let index = 1; index < owners.length; index++) {
        const owner = owners[index];
        await signWithAddress(web3, safeSdk, safeTransaction, owner);
    }

    // owner1 execute (and implicitly signs) the transaction
    const safeTxResponse = await safeSdk.executeTransaction(safeTransaction, {
        // we need to manually set the gasLimit in order to execute multisig tx on rsk
        gasLimit: '1081903'
    });
    await getTransactionReceipt(web3, safeTxResponse.hash);

    console.log('---Token balance after---');
    await printStatus(collectorAddress, owners, testTokenInstance);

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
