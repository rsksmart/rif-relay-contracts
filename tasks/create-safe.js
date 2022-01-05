const safeFactoryABI = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'contract GnosisSafeProxy',
                name: 'proxy',
                type: 'address'
            }
        ],
        name: 'ProxyCreation',
        type: 'event'
    },
    {
        constant: false,
        inputs: [
            {
                internalType: 'address',
                name: 'masterCopy',
                type: 'address'
            },
            {
                internalType: 'bytes',
                name: 'data',
                type: 'bytes'
            }
        ],
        name: 'createProxy',
        outputs: [
            {
                internalType: 'contract GnosisSafeProxy',
                name: 'proxy',
                type: 'address'
            }
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'proxyRuntimeCode',
        outputs: [
            {
                internalType: 'bytes',
                name: '',
                type: 'bytes'
            }
        ],
        payable: false,
        stateMutability: 'pure',
        type: 'function'
    },
    {
        constant: true,
        inputs: [],
        name: 'proxyCreationCode',
        outputs: [
            {
                internalType: 'bytes',
                name: '',
                type: 'bytes'
            }
        ],
        payable: false,
        stateMutability: 'pure',
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            {
                internalType: 'address',
                name: '_mastercopy',
                type: 'address'
            },
            {
                internalType: 'bytes',
                name: 'initializer',
                type: 'bytes'
            },
            {
                internalType: 'uint256',
                name: 'saltNonce',
                type: 'uint256'
            }
        ],
        name: 'createProxyWithNonce',
        outputs: [
            {
                internalType: 'contract GnosisSafeProxy',
                name: 'proxy',
                type: 'address'
            }
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            {
                internalType: 'address',
                name: '_mastercopy',
                type: 'address'
            },
            {
                internalType: 'bytes',
                name: 'initializer',
                type: 'bytes'
            },
            {
                internalType: 'uint256',
                name: 'saltNonce',
                type: 'uint256'
            },
            {
                internalType: 'contract IProxyCreationCallback',
                name: 'callback',
                type: 'address'
            }
        ],
        name: 'createProxyWithCallback',
        outputs: [
            {
                internalType: 'contract GnosisSafeProxy',
                name: 'proxy',
                type: 'address'
            }
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        constant: false,
        inputs: [
            {
                internalType: 'address',
                name: '_mastercopy',
                type: 'address'
            },
            {
                internalType: 'bytes',
                name: 'initializer',
                type: 'bytes'
            },
            {
                internalType: 'uint256',
                name: 'saltNonce',
                type: 'uint256'
            }
        ],
        name: 'calculateCreateProxyWithNonceAddress',
        outputs: [
            {
                internalType: 'contract GnosisSafeProxy',
                name: 'proxy',
                type: 'address'
            }
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function'
    }
];
const safeProxyFactoryAddress = '0x73ec81da0C72DD112e06c09A6ec03B5544d26F05';

const safeMasterCopyAddress = '0x83C5541A6c8D2dBAD642f385d8d06Ca9B6C731ee';
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

async function deploySafe(web3, owners, threshold, initialBalance) {
    // TODO: We could receive safeProxyFactoryAddress and safeMasterCopyAddress from input
    const accounts = await web3.eth.getAccounts();
    const sender = accounts[0];

    const safeFactoryContract = new web3.eth.Contract(
        safeFactoryABI,
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
    // console.log('createTx', { createTx });
    const safeAddressCreated =
        createTx?.events?.ProxyCreation?.returnValues.proxy;
    console.log({ safeAddressCreated });

    
    // give some rbtc to the safe account just created
    const sendBalanceTx = await web3.eth.sendTransaction({
        to: safeAddressCreated,
        value: initialBalance,
        from: sender
    });
    // console.log('sendBalanceTx', sendBalanceTx);
    return safeAddressCreated;
}

module.exports = async (callback) => {
    const accounts = await web3.eth.getAccounts();

    const owner1 = accounts[0];
    const owner2 = accounts[1];
    const threshold = 2;
    const initialBalance = web3.utils.toWei('10');

    const safeAddress = await deploySafe(web3, [owner1, owner2], threshold, initialBalance);
    
    const safeBalance = await web3.eth.getBalance(safeAddress);
    console.log('Safe balance', web3.utils.fromWei(safeBalance));

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
