const safeCoreSdk = require('@gnosis.pm/safe-core-sdk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const {
    signWithAddress,
    contractNetworks,
    getTransactionReceipt
} = require('./utils');
const argv = yargs(hideBin(process.argv)).parserConfiguration({
    'parse-numbers': false
}).argv;
const { default: Safe, Web3Adapter } = safeCoreSdk;

const printStatus = async (collectorAddress, partners, erc20TokenInstance) => {
    const collectorBalance = await getERC20Balance(
        erc20TokenInstance,
        collectorAddress
    );
    console.log(`Collector balance: ${collectorBalance}`);
    for (const owner of partners) {
        const balance = await getERC20Balance(erc20TokenInstance, owner);
        console.log(`Address ${owner} balance: ${balance}`);
    }
};

const getMinimumErc20TokenContract = (web3, tokenAddress) => {
    // The minimum ABI required to get the ERC20 Token balance
    const minABI = [
        // balanceOf
        {
            constant: true,
            inputs: [{ name: '_owner', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: 'balance', type: 'uint256' }],
            type: 'function'
        }
    ];
    return new web3.eth.Contract(minABI, tokenAddress);
};

const getERC20Balance = async (erc20Contract, address) => {
    return await erc20Contract.methods.balanceOf(address).call();
};

module.exports = async (callback) => {
    const {
        safeAddress,
        safeOwners,
        collectorAddress,
        tokenAddress,
        partners
    } = argv;
    // If safeAddress is specified, then we need a multisig transaction to withdraw
    const isMultisigWithdraw = ![null, undefined].includes(safeAddress);
    if (isMultisigWithdraw && !web3.utils.isAddress(safeAddress)) {
        callback(new Error(`invalid "safeAddress": ${safeAddress}`));
        return;
    }
    const parsedSafeOwners = safeOwners && safeOwners.split(',');
    if (isMultisigWithdraw && !parsedSafeOwners) {
        callback(
            new Error(
                `invalid "safeOwners" parameter received: ${safeOwners}; it accepts a comma-separated list of addresses.`
            )
        );
        return;
    }
    if (!web3.utils.isAddress(collectorAddress)) {
        callback(new Error(`invalid "collectorAddress": ${collectorAddress}`));
        return;
    }
    const parsedPartners = partners && partners.split(',');
    if (!parsedPartners) {
        callback(new Error(`invalid "partners": ${partners}`));
        return;
    }

    // Log the initial status
    if (isMultisigWithdraw) {
        const safeBalance = await web3.eth.getBalance(safeAddress);
        console.log('Safe balance', web3.utils.fromWei(safeBalance));
    }
    const erc20TokenInstance = await getMinimumErc20TokenContract(
        web3,
        tokenAddress
    );
    console.log('---Token balance before---');
    await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);

    const encodedWithdrawFunction = web3.eth.abi.encodeFunctionCall(
        {
            name: 'withdraw',
            type: 'function',
            inputs: []
        },
        []
    );
    const withdrawTx = {
        to: collectorAddress,
        value: 0,
        data: encodedWithdrawFunction
    };

    let withdrawTxHash;
    if (isMultisigWithdraw) {
        const ethAdapterOwner1 = new Web3Adapter({
            web3,
            signerAddress: parsedSafeOwners[0]
        });
        const safeSdk = await Safe.create({
            ethAdapter: ethAdapterOwner1,
            safeAddress,
            contractNetworks
        });
        const transactions = [withdrawTx];
        const safeTransaction = await safeSdk.createTransaction(
            ...transactions
        );

        // All the safe owners but the first one will sign the transaction before,
        // while the parsedSafeOwners[0] will sign the transaction on execution.
        for (let index = 1; index < parsedSafeOwners.length; index++) {
            const owner = parsedSafeOwners[index];
            await signWithAddress(web3, safeSdk, safeTransaction, owner);
        }

        /*
         * TODO: We need to manually set the gasLimit in order to execute multisig tx on rsk regtest;
         *       likely this value is going to change on testnet/mainnet
         */
        const safeTxGasLimit = '300000';
        // owner1 execute (and implicitly signs) the transaction
        const safeTxResponse = await safeSdk.executeTransaction(
            safeTransaction,
            {
                gasLimit: safeTxGasLimit
            }
        );
        withdrawTxHash = safeTxResponse.hash;
    } else {
        // TODO: We saw that '137410' is required in regtest, likely this value is going to change on testnet/mainnet
        const gasRequired = '140000';
        const tx = await web3.eth.sendTransaction({
            ...withdrawTx,
            from: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
            gas: gasRequired
        });
        withdrawTxHash = tx.transactionHash;
    }

    await getTransactionReceipt(web3, withdrawTxHash);

    console.log('---Token balance after---');
    await printStatus(collectorAddress, parsedPartners, erc20TokenInstance);

    // try to execute a transaction, but then we need to move this part into anther task probably
    callback();
};
