const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { getTestTokenInstance, getCollectorInstance, signWithAddress, contractNetworks } = require('./utils');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { default: Safe, Web3Adapter } = safeCoreSdk;


module.exports = async (callback) => {
    const accounts = await web3.eth.getAccounts();

    const owner1 = accounts[0];
    const owner2 = accounts[1];

    // TODO: To be changed according with the partner addresses
    const owners = [owner1, owner2];

    const { safeAddress } = argv;
    if (!web3.utils.isAddress(safeAddress)) {
        callback(new Error(`invalid "safeAddress": ${safeAddress}`));
    }

    // print the initial status
    const safeBalance = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance', web3.utils.fromWei(safeBalance));
    const testTokenInstance = await getTestTokenInstance(artifacts);
    
    console.log('---Token balance before---');
    for (const owner of owners) {
        const balance = await testTokenInstance.balanceOf(owner);
        console.log(`Address ${owner}: ${balance}`);
    }

    const ethAdapterOwner1 = new Web3Adapter({
        web3,
        signerAddress: owner1
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

    const collectorInstance = await getCollectorInstance(artifacts);
    const transactions = [
        {
            to: collectorInstance.address,
            value: 0,
            data: encodedWithdrawFunction
        }
    ];
    const safeTransaction = await safeSdk.createTransaction(...transactions);

    // TODO: To be changed according with the number of safe owners
    /**
     * The first owner will sign and execute the transaction
    for (let index = 1; index < owners.length; index++) {
        const owner = owners[index];
        await signWithAddress(web3, safeSdk, safeTransaction, owner);
    }
     */
    // owner2 signs the transaction
    await signWithAddress(web3, safeSdk, safeTransaction, owner2);

    // owner1 execute (and implicitly signs) the transaction
    const safeTxResponse = await safeSdk.executeTransaction(safeTransaction, {
        // we need to manually set the gasLimit in order to execute multisig tx on rsk
        gasLimit: '1081903'
    });
    await safeTxResponse.transactionResponse?.wait();

    console.log('---Token balance after---');
    for (const owner of owners) {
        const balance = await testTokenInstance.balanceOf(owner);
        console.log(`Address ${owner}: ${balance}`);
    }

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
