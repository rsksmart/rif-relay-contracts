import { use, assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { ethers } from 'ethers';
import { soliditySha3Raw } from 'web3-utils';
import {
    CustomSmartWalletFactoryInstance,
    CustomSmartWalletInstance,
    TestTokenInstance
} from '../../types/truffle-contracts';
import { constants } from '../constants';
import {
    createRequest,
    generateBytes32,
    getTestingEnvironment,
    getTokenBalance,
    mintTokens,
    signRequest
} from '../utils';

use(chaiAsPromised);

const CustomSmartWallet = artifacts.require('CustomSmartWallet');
const CustomSmartWalletFactory = artifacts.require('CustomSmartWalletFactory');
const TestToken = artifacts.require('TestToken');

type createUserSmartWalletParam = {
    owner: string;
    recoverer: string;
    logicAddress: string;
    index: string;
    initParams: string;
};

/**
 * Function to get the actual token balance for an account
 * @param ownerAddress
 * @param ownerPrivateKey
 * @param recoverer
 * @param logicAddress
 * @param index
 * @param initParams
 * @returns The createUserSmartWallet signed
 */
function createUserSmartWalletSignature(
    ownerPrivateKey: Buffer,
    object: createUserSmartWalletParam
): string {
    const { owner, recoverer, logicAddress, index, initParams } = object;

    const toSign: string =
        web3.utils.soliditySha3(
            { t: 'bytes2', v: '0x1910' },
            { t: 'address', v: owner },
            { t: 'address', v: recoverer },
            { t: 'address', v: logicAddress },
            { t: 'uint256', v: index },
            { t: 'bytes', v: initParams }
        ) ?? '';
    const toSignAsBinaryArray = ethers.utils.arrayify(toSign);
    const signingKey = new ethers.utils.SigningKey(ownerPrivateKey);
    const signature = signingKey.signDigest(toSignAsBinaryArray);
    const signatureCollapsed = ethers.utils.joinSignature(signature);

    return signatureCollapsed;
}

contract('CustomSmartWalletFactory', ([worker]) => {
    let chainId: number;
    let factory: CustomSmartWalletFactoryInstance;
    const ownerPrivateKey = toBuffer(generateBytes32(1));
    let ownerAddress: string;

    beforeEach(async () => {
        chainId = (await getTestingEnvironment()).chainId;
        const smartWallet = await CustomSmartWallet.new();
        factory = await CustomSmartWalletFactory.new(smartWallet.address);
        ownerAddress = bufferToHex(
            privateToAddress(ownerPrivateKey)
        ).toLowerCase();
    });

    describe('createUserSmartWallet', () => {
        const logicAddress = constants.ZERO_ADDRESS;
        const initParams = '0x';
        const recoverer = constants.ZERO_ADDRESS;
        const index = '0';

        it('Should initiate the smart wallet in the expected address', async () => {
            const smartWalletAddress = await factory.getSmartWalletAddress(
                ownerAddress,
                recoverer,
                logicAddress,
                soliditySha3Raw({ t: 'bytes', v: initParams }),
                index
            );

            await assert.isRejected(
                CustomSmartWallet.at(smartWalletAddress),
                `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
            );

            const signatureCollapsed = createUserSmartWalletSignature(
                ownerPrivateKey,
                {
                    owner: ownerAddress,
                    recoverer,
                    logicAddress,
                    initParams,
                    index
                }
            );

            await factory.createUserSmartWallet(
                ownerAddress,
                recoverer,
                logicAddress,
                index,
                initParams,
                signatureCollapsed
            );

            const smartWallet: CustomSmartWalletInstance =
                await CustomSmartWallet.at(smartWalletAddress);

            await assert.eventually.isTrue(smartWallet.isInitialized());
        });

        it('Should verify method initialize fails with a ZERO owner address parameter', async () => {
            const signatureCollapsed = createUserSmartWalletSignature(
                ownerPrivateKey,
                {
                    owner: constants.ZERO_ADDRESS,
                    recoverer,
                    logicAddress,
                    initParams,
                    index
                }
            );

            await assert.isRejected(
                factory.createUserSmartWallet(
                    constants.ZERO_ADDRESS,
                    recoverer,
                    logicAddress,
                    index,
                    initParams,
                    signatureCollapsed
                ),
                'Returned error: VM Exception while processing transaction: revert Invalid signature'
            );
        });
    });

    describe('relayedUserSmartWalletCreation', () => {
        let token: TestTokenInstance;
        const logicAddress = constants.ZERO_ADDRESS;
        const initParams = '0x';
        const recoverer = constants.ZERO_ADDRESS;
        const index = '0';

        beforeEach(async () => {
            token = await TestToken.new();
        });

        it('Should initialize the smart wallet in the expected address without paying fee', async () => {
            const smartWalletAddress = await factory.getSmartWalletAddress(
                ownerAddress,
                recoverer,
                logicAddress,
                soliditySha3Raw({ t: 'bytes', v: initParams }),
                index
            );

            const initialWorkerBalance = await getTokenBalance(token, worker);
            assert.equal(initialWorkerBalance.toString(), '0');

            await assert.isRejected(
                CustomSmartWallet.at(smartWalletAddress),
                `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
            );

            const relayRequest = createRequest(
                {
                    from: ownerAddress,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '0',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                ownerPrivateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                signature,
                {
                    from: worker
                }
            );

            const smartWallet: CustomSmartWalletInstance =
                await CustomSmartWallet.at(smartWalletAddress);

            await assert.eventually.isTrue(smartWallet.isInitialized());

            const finalWorkerBalance = await getTokenBalance(token, worker);
            assert.equal(finalWorkerBalance.toString(), '0');
        });

        it('Should initialize the smart wallet in the expected address paying fee', async () => {
            const smartWalletAddress = await factory.getSmartWalletAddress(
                ownerAddress,
                recoverer,
                logicAddress,
                soliditySha3Raw({ t: 'bytes', v: initParams }),
                index
            );

            const initialWorkerBalance = await getTokenBalance(token, worker);
            assert.equal(initialWorkerBalance.toString(), '0');

            await mintTokens(token, smartWalletAddress, '1000');

            await assert.isRejected(
                CustomSmartWallet.at(smartWalletAddress),
                `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
            );

            const fee = '500';

            const relayRequest = createRequest(
                {
                    from: ownerAddress,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: fee,
                    tokenGas: '50000',
                    recoverer: recoverer,
                    index: index,
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                ownerPrivateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                signature,
                {
                    from: worker
                }
            );

            const smartWallet: CustomSmartWalletInstance =
                await CustomSmartWallet.at(smartWalletAddress);

            await assert.eventually.isTrue(smartWallet.isInitialized());

            const finalWorkerBalance = await getTokenBalance(token, worker);
            assert.equal(finalWorkerBalance.toString(), fee);
        });

        it('Should verify method initialize reverts with negative token amount', async () => {
            const relayRequest = createRequest(
                {
                    from: ownerAddress,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '-100',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            assert.throw(
                () => signRequest(ownerPrivateKey, relayRequest, chainId),
                'Supplied uint is negative'
            );
        });

        it('Should verify method initialize successfully with token as ZERO address parameter', async () => {
            const smartWalletAddress = await factory.getSmartWalletAddress(
                ownerAddress,
                recoverer,
                logicAddress,
                soliditySha3Raw({ t: 'bytes', v: initParams }),
                index
            );

            await assert.isRejected(
                CustomSmartWallet.at(smartWalletAddress),
                `Cannot create instance of CustomSmartWallet; no code at address ${smartWalletAddress}`
            );

            const relayRequest = createRequest(
                {
                    from: ownerAddress,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: constants.ZERO_ADDRESS,
                    tokenAmount: '0',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                ownerPrivateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                signature,
                {
                    from: worker
                }
            );

            const smartWallet: CustomSmartWalletInstance =
                await CustomSmartWallet.at(smartWalletAddress);

            await assert.eventually.isTrue(smartWallet.isInitialized());
        });
    });
});
