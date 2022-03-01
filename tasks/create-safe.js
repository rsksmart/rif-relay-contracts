const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { contractNetworks } = require('./utils');
const SafeFactory = require('./safeFactory.json');

const setupFunctionDefinition = {
    constant: false,
    inputs: [
        {
            internalType: 'address[]',
            name: '_owners',
            type: 'address[]'
        },
        {
            internalType: 'uint256',
            name: '_threshold',
            type: 'uint256'
        },
        {
            internalType: 'address',
            name: 'to',
            type: 'address'
        },
        {
            internalType: 'bytes',
            name: 'data',
            type: 'bytes'
        },
        {
            internalType: 'address',
            name: 'fallbackHandler',
            type: 'address'
        },
        {
            internalType: 'address',
            name: 'paymentToken',
            type: 'address'
        },
        {
            internalType: 'uint256',
            name: 'payment',
            type: 'uint256'
        },
        {
            internalType: 'address payable',
            name: 'paymentReceiver',
            type: 'address'
        }
    ],
    name: 'setup',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
};
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const EMPTY_DATA = '0x';

async function deploySafe(
    web3,
    safeMasterCopyAddress,
    safeProxyFactoryAddress,
    owners,
    threshold,
    initialBalance
) {
    const accounts = await web3.eth.getAccounts();
    const sender = accounts[0];

    const safeFactoryContract = new web3.eth.Contract(
        SafeFactory.abi,
        safeProxyFactoryAddress
    );
    const encodedSetupFunction = web3.eth.abi.encodeFunctionCall(
        setupFunctionDefinition,
        [
            owners,
            threshold,
            ZERO_ADDRESS,
            EMPTY_DATA,
            ZERO_ADDRESS,
            ZERO_ADDRESS,
            0,
            ZERO_ADDRESS
        ]
    );
    // TODO: Value extracted from regtest, likely we need to adapt it for testnet/mainnet
    const createTxGasLimit = '1081903';
    const createTx = await safeFactoryContract.methods
        .createProxy(safeMasterCopyAddress, encodedSetupFunction)
        .send({ from: sender, gas: createTxGasLimit });

    const safeAddressCreated =
        createTx?.events?.ProxyCreation?.returnValues.proxy;
    console.log({ safeAddressCreated });

    // give some rbtc to the safe account just created
    await web3.eth.sendTransaction({
        to: safeAddressCreated,
        value: initialBalance,
        from: sender
    });
    return safeAddressCreated;
}

module.exports = async (callback) => {
    const chainId = await web3.eth.getChainId();
    const { safeMasterCopyAddress, safeProxyFactoryAddress } =
        contractNetworks[chainId];

    let { owners } = argv;
    if (!owners) {
        console.warn(
            "Missing '--owners' parameter. The first 4 addresses retrieved from 'web3.eth.getAccounts' will be used."
        );
        const accounts = await web3.eth.getAccounts();
        if (accounts.length < 4) {
            callback(
                new Error(
                    'No enough addresses can be retrieved using "web3.eth.getAccounts"'
                )
            );
            return;
        }
        const [owner1, owner2, owner3, owner4] = accounts;
        owners = [owner1, owner2, owner3, owner4];
    } else {
        owners = owners.split(',');
    }

    const threshold = owners.length;
    const initialBalance = web3.utils.toWei('10');

    const safeAddress = await deploySafe(
        web3,
        safeMasterCopyAddress,
        safeProxyFactoryAddress,
        owners,
        threshold,
        initialBalance
    );

    const safeBalance = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance', web3.utils.fromWei(safeBalance));

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
