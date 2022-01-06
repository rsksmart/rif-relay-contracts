const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { default: Safe, Web3Adapter } = safeCoreSdk;
const { contractNetworks, signWithAddress } = require('./utils');
const RevenueSharingAddresses = require('../revenue-sharing-addresses.json');

const EMPTY_DATA = '0x';

/**
 * This script can be called with the following format:
 * `npx truffle --network regtest exec tasks/send-multisig.js --safeAddress='0x3d9518b0852183c5c544a2161575208A6543D61C'`
 * Please keep in mind the following assumptions:
 * 1. the safe have two owners, that are the first two accounts (accounts[0], accounts[1])
 * 2. the safe is created with a threshold set to 2
 * 3. the safe has some funds
 */
module.exports = async (callback) => {
    const accounts = await web3.eth.getAccounts();

    const chainId = await web3.eth.getChainId();
    const {
        relayOperator,
        walletProvider,
        liquidityProvider,
        iovLabsRecipient
    } = RevenueSharingAddresses[chainId.toString()];
    const owners = [
        relayOperator,
        walletProvider,
        liquidityProvider,
        iovLabsRecipient
    ];

    // check the address received
    const { safeAddress } = argv;
    if (!web3.utils.isAddress(safeAddress)) {
        callback(
            new Error(`invalid "safeAddress": ${safeAddress}`)
        );
    }
    // print the initial balance
    const safeBalance = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance', web3.utils.fromWei(safeBalance));

    // initialize the sdk to sign transaction with the first owner
    const ethAdapterOwner1 = new Web3Adapter({
        web3,
        signerAddress: owners[0]
    });
    const safeSdk = await Safe.create({
        ethAdapter: ethAdapterOwner1,
        safeAddress,
        contractNetworks
    });

    const receiver = accounts[2];
    const balanceReceiverBefore = await web3.eth.getBalance(receiver);
    console.log('Receiver balance before the transaction execution', web3.utils.fromWei(balanceReceiverBefore));
    
    // create the transaction 
    const transactions = [{
        to: receiver,
        value: web3.utils.toWei('1'),
        data: EMPTY_DATA
    }];
    const safeTransaction = await safeSdk.createTransaction(...transactions);

    //The first owner will sign and execute the transaction
    for (let index = 1; index < owners.length; index++) {
        const owner = owners[index];
        await signWithAddress(web3, safeSdk, safeTransaction, owner);
    }

    // owners[0] executes (and implicitly signs) the transaction
    const safeTxResponse = await safeSdk.executeTransaction(safeTransaction, {gasLimit:'1081903'});

    await safeTxResponse.transactionResponse?.wait();
    
    // print the balance after the transaction execution
    const balanceReceiverAfter = await web3.eth.getBalance(receiver);
    console.log('Receiver balance after the transaction execution', web3.utils.fromWei(balanceReceiverAfter));
    const safeBalanceAfter = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance after the transaction is executed', web3.utils.fromWei(safeBalanceAfter));

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
