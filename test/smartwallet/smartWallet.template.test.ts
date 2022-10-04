import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { SmartWalletInstance } from '../../types/truffle-contracts';
import { constants } from '../constants';

use(chaiAsPromised);

const SmartWallet = artifacts.require('SmartWallet');

contract('SmartWallet - template', ([owner]) => {
    describe('initialize', () => {
        let smartWallet: SmartWalletInstance;

        beforeEach(async () => {
            smartWallet = await SmartWallet.new();
        });

        it('Should be initialized during the deployment', async () => {
            await expect(smartWallet.isInitialized()).to.eventually.be.true;
        });

        it('Should verify method initialize fails when contract has already deployed', async () => {
            const tokenAddress = constants.ZERO_ADDRESS;
            const recipient = constants.ZERO_ADDRESS;

            await expect(
                smartWallet.initialize(
                    owner,
                    tokenAddress,
                    recipient,
                    '0',
                    '5000'
                )
            ).to.be.rejectedWith('already initialized');
        });
    });
});
