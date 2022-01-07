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

async function deploySafe(web3, safeMasterCopyAddress, safeProxyFactoryAddress, owners, threshold, initialBalance) {
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
    const createTx = await safeFactoryContract.methods
        .createProxy(safeMasterCopyAddress, encodedSetupFunction)
        .send({ from: sender, gas: '1081903' });
    
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
    // These addresses are the same of the ones used in migrations/3_revenue_sharing.js
    const relayOperator = '0x7986b3DF570230288501EEa3D890bd66948C9B79';     // accounts[1]
    const walletProvider = '0x0a3aA774752ec2042c46548456c094A76C7F3a79';    // accounts[2] 
    const liquidityProvider = '0xCF7CDBbB5F7BA79d3ffe74A0bBA13FC0295F6036'; // accounts[3] 
    const iovLabsRecipient = '0x39B12C05E8503356E3a7DF0B7B33efA4c054C409';  // accounts[4] 

    const { safeMasterCopyAddress, safeProxyFactoryAddress } = contractNetworks[chainId];

    const owners = [
        relayOperator,
        walletProvider,
        liquidityProvider,
        iovLabsRecipient
    ];
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
