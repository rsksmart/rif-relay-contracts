import { AccountKeypair } from '@rsksmart/rif-relay-client';
import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
    SmartWalletFactoryInstance,
    SmartWalletInstance,
    TestTokenInstance
} from '../../types/truffle-contracts';
import { constants } from '../constants';
import {
    createRequest,
    getGaslessAccount,
    getTestingEnvironment,
    getTokenBalance,
    mintTokens,
    signRequest
} from '../utils';
import { createValidPersonalSignSignature } from './utils';

use(chaiAsPromised);

const SmartWallet = artifacts.require('SmartWallet');
const SmartWalletFactory = artifacts.require('SmartWalletFactory');
const TestToken = artifacts.require('TestToken');

type createUserSmartWalletParam = {
    owner: string;
    recoverer: string;
    index: string;
    factoryAddress: string;
};

/**
 * Function to get the actual token balance for an account
 * @param owner.address
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
    const { owner, recoverer, index, factoryAddress } = object;
    const message = web3.utils.soliditySha3(
        { t: 'address', v: factoryAddress },
        { t: 'address', v: owner },
        { t: 'address', v: recoverer },
        { t: 'uint256', v: index }
    );
    return createValidPersonalSignSignature(ownerPrivateKey, message);
}

contract('SmartWalletFactory', ([worker, otherAccount]) => {
    let chainId: number;
    let factory: SmartWalletFactoryInstance;
    let owner: AccountKeypair;

    beforeEach(async () => {
        owner = await getGaslessAccount();
        chainId = (await getTestingEnvironment()).chainId;
        const smartWallet = await SmartWallet.new();
        factory = await SmartWalletFactory.new(smartWallet.address);
    });

    describe('createUserSmartWallet', async () => {
        const recoverer = constants.ZERO_ADDRESS;
        const index = '0';

        it('Should initiate the smart wallet in the expected address', async () => {
            const smartWalletAddress = await factory.getSmartWalletAddress(
                owner.address,
                recoverer,
                index
            );

            await expect(SmartWallet.at(smartWalletAddress)).to.be.rejectedWith(
                `Cannot create instance of SmartWallet; no code at address ${smartWalletAddress}`
            );

            const signatureCollapsed = createUserSmartWalletSignature(
                owner.privateKey,
                {
                    owner: owner.address,
                    recoverer,
                    index,
                    factoryAddress: factory.address
                }
            );

            await factory.createUserSmartWallet(
                owner.address,
                recoverer,
                index,
                signatureCollapsed
            );

            const smartWallet: SmartWalletInstance = await SmartWallet.at(
                smartWalletAddress
            );

            await expect(smartWallet.isInitialized()).to.eventually.be.true;
        });

        it('Should fail with a ZERO owner address parameter', async () => {
            const signatureCollapsed = createUserSmartWalletSignature(
                owner.privateKey,
                {
                    owner: constants.ZERO_ADDRESS,
                    recoverer,
                    index,
                    factoryAddress: factory.address
                }
            );

            await expect(
                factory.createUserSmartWallet(
                    constants.ZERO_ADDRESS,
                    recoverer,
                    index,
                    signatureCollapsed
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert Invalid signature'
            );
        });

        it('Should fail when signature does not match', async () => {
            const signatureCollapsed = createUserSmartWalletSignature(
                owner.privateKey,
                {
                    owner: owner.address,
                    recoverer,
                    index,
                    factoryAddress: factory.address
                }
            );

            await expect(
                factory.createUserSmartWallet(
                    otherAccount,
                    recoverer,
                    index,
                    signatureCollapsed
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert Invalid signature'
            );
        });
    });

    describe('relayedUserSmartWalletCreation', () => {
        let smartWalletAddress: string;
        let token: TestTokenInstance;
        const logicAddress = constants.ZERO_ADDRESS;
        const initParams = '0x';
        const recoverer = constants.ZERO_ADDRESS;
        const index = '0';

        beforeEach(async () => {
            token = await TestToken.new();
            smartWalletAddress = await factory.getSmartWalletAddress(
                owner.address,
                recoverer,
                index
            );
        });

        it('Should initialize the smart wallet in the expected address without paying fee', async () => {
            const initialWorkerBalance = await getTokenBalance(token, worker);
            expect(initialWorkerBalance.toString()).to.be.equal('0');

            await expect(SmartWallet.at(smartWalletAddress)).to.be.rejectedWith(
                `Cannot create instance of SmartWallet; no code at address ${smartWalletAddress}`
            );

            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '0',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                worker,
                signature,
                {
                    from: worker
                }
            );

            const smartWallet: SmartWalletInstance = await SmartWallet.at(
                smartWalletAddress
            );

            await expect(smartWallet.isInitialized()).to.eventually.be.true;

            const finalWorkerBalance = await getTokenBalance(token, worker);
            await expect(finalWorkerBalance.toString()).to.be.equal('0');
        });

        it('Should initialize the smart wallet in the expected address paying fee', async () => {
            const initialWorkerBalance = await getTokenBalance(token, worker);
            expect(initialWorkerBalance.toString()).to.be.equal('0');

            await mintTokens(token, smartWalletAddress, '1000');
            const fee = '500';

            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: fee,
                    tokenGas: '50000',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                worker,
                signature,
                {
                    from: worker
                }
            );

            const smartWallet: SmartWalletInstance = await SmartWallet.at(
                smartWalletAddress
            );

            await expect(smartWallet.isInitialized()).to.eventually.be.true;

            const finalWorkerBalance = await getTokenBalance(token, worker);
            await expect(finalWorkerBalance.toString()).to.be.equal(fee);
        });

        it('Should fail with negative token amount', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '-100',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            expect(() =>
                signRequest(owner.privateKey, relayRequest, chainId)
            ).to.throw('Supplied uint is negative');
        });

        it('Should fail with token as ZERO address parameter', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: constants.ZERO_ADDRESS,
                    tokenAmount: '5000',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await factory.relayedUserSmartWalletCreation(
                relayRequest.request,
                suffixData,
                worker,
                signature,
                {
                    from: worker
                }
            );
            const smartWallet: SmartWalletInstance = await SmartWallet.at(
                smartWalletAddress
            );

            await expect(smartWallet.isInitialized()).to.eventually.be.true;
        });

        it('Should fail when owner does not have funds to pay', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '5000',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await expect(
                factory.relayedUserSmartWalletCreation(
                    relayRequest.request,
                    suffixData,
                    worker,
                    signature,
                    {
                        from: worker
                    }
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert Unable to initialize SW'
            );
        });

        it('Should fail when invalid caller(Not relayHub)', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '5000',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    validUntilTime: '0',
                    relayHub: otherAccount
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await expect(
                factory.relayedUserSmartWalletCreation(
                    relayRequest.request,
                    suffixData,
                    worker,
                    signature,
                    {
                        from: worker
                    }
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert Invalid caller'
            );
        });

        it('Should fail when nonce does not match', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '5000',
                    tokenGas: '0',
                    recoverer: recoverer,
                    index: index,
                    relayHub: worker,
                    validUntilTime: '0',
                    nonce: '1'
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            await expect(
                factory.relayedUserSmartWalletCreation(
                    relayRequest.request,
                    suffixData,
                    worker,
                    signature,
                    {
                        from: worker
                    }
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert nonce mismatch'
            );
        });

        it('Should fail when signature does not match', async () => {
            const relayRequest = createRequest(
                {
                    from: owner.address,
                    to: logicAddress,
                    data: initParams,
                    tokenContract: token.address,
                    tokenAmount: '5000',
                    tokenGas: '0',
                    index: index,
                    validUntilTime: '0',
                    relayHub: worker
                },
                {
                    callForwarder: factory.address
                }
            );

            const { signature, suffixData } = signRequest(
                owner.privateKey,
                relayRequest,
                chainId
            );

            relayRequest.request.from = otherAccount;

            await expect(
                factory.relayedUserSmartWalletCreation(
                    relayRequest.request,
                    suffixData,
                    worker,
                    signature,
                    {
                        from: worker
                    }
                )
            ).to.be.rejectedWith(
                'Returned error: VM Exception while processing transaction: revert Signature mismatch'
            );
        });
    });
});
