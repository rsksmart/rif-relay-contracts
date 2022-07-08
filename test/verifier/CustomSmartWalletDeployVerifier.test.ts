import { CustomSmartWalletDeployVerifierInstance, TestTokenInstance, CustomSmartWalletFactoryInstance, CustomSmartWalletInstance } from '../../types/truffle-contracts';
import { constants, DeployRequest, getDomainSeparatorHash } from '@rsksmart/rif-relay-common';
import { Address } from '@rsksmart/rif-relay-client';
import { toBuffer, bufferToHex, privateToAddress } from 'ethereumjs-util';
import { bytes32, createCustomSmartWalletFactory, getTestingEnvironment} from '../utils/TestUtils';
import { soliditySha3Raw } from 'web3-utils';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const assert = chai.assert;

//Constants and general values
const CustomSmartWalletDeployVerifier = artifacts.require('CustomSmartWalletDeployVerifier');
const TestToken = artifacts.require('TestToken');
const CustomSmartWallet = artifacts.require('CustomSmartWallet');

const gasPrice = '10';
const senderNonce = '0';
const tokensPaid = 1;

contract('Testing Tokens - CustomSmartWalletDeployVerifier contract', ()=>{
        let token: TestTokenInstance;
        let smarWallet: CustomSmartWalletInstance;
        let factory: CustomSmartWalletFactoryInstance;
        let contractVerifier: CustomSmartWalletDeployVerifierInstance;
    describe('Testing tokens acceptance', () =>{
        beforeEach('', async ()=>{
            token = await TestToken.new();
            smarWallet = await CustomSmartWallet.new();
            factory = await createCustomSmartWalletFactory(smarWallet);
            contractVerifier = await CustomSmartWalletDeployVerifier.new(factory.address);
            
        });
            it('Should verify the contract accepts test tokens', async ()=>{
                await contractVerifier.acceptToken(token.address);
                assert.isTrue(await contractVerifier.acceptsToken(token.address), 'Contract does not accepts token');
            });

            it('Should verify the contract accepts more than one test tokens and verify tokens added are listed', async ()=>{
                //Creating tokens
                const tokens =[token];
                tokens.push(await TestToken.new());
                tokens.push(await TestToken.new());

                //Adding tokens to contract list
                for(const tkn of tokens){
                    const rspToken = await contractVerifier.acceptToken(tkn.address);
                    assert.isEmpty(rspToken.logs, 'Log found for txn, token not accepted');
                }
                
                //Verifying contract tokens list
                const accepted_Tokens = await contractVerifier.getAcceptedTokens();
                assert.isTrue(tokens.some(tkn => accepted_Tokens.includes(tkn.address.toString())));
            });

            it('Should verify the contract does not accept a duplicated test token', async ()=>{
                //Adding first token
                const rspToken = await contractVerifier.acceptToken(token.address);
                assert.isEmpty(rspToken.logs, 'Log found for txn, token not accepted');
               
                //Adding second token
                const  token2 = await TestToken.new();
                const rspToken2 = await contractVerifier.acceptToken(token2.address);
                assert.isEmpty(rspToken2.logs, 'Log found for txn, token not accepted');
                
                await assert.isRejected(contractVerifier.acceptToken(token.address), 'Token is already accepted', 'A duplicated token was accepted');
            });

            it('Should verify the contract does not accepts an invalid test token address', async ()=>{
                const invalid_address = web3.eth.accounts.create();
                await assert.isRejected(contractVerifier.acceptToken(invalid_address.address.toUpperCase()),'invalid address' ,'Contract does not accept this token: '+ invalid_address);
            });

            it('Should verify the contract version', async ()=>{
                const version = await contractVerifier.versionVerifier();
                assert.isString(version,'Version not properly retrieved');
            });
    });
});

contract('Testing verifyRelayedCall - CustomSmartWalletDeployVerifier contract', ([relayHub, relayWorker])=>{
        let deployRequestData: DeployRequest;
        let token: TestTokenInstance;
        let smarWallet: CustomSmartWalletInstance;
        let factory: CustomSmartWalletFactoryInstance;
        let contractVerifier: CustomSmartWalletDeployVerifierInstance;
    
        let expectedAddress: Address;    
    describe('Testing call to verifyRelayedCall method', ()=>{
        const ownerPrivateKey = toBuffer(bytes32(1));
        let ownerAddress: string;

        const recoverer = constants.ZERO_ADDRESS;
        const index = '0';

        beforeEach('Creating instances to be used by every test', async ()=>{
                
            ownerAddress = bufferToHex(privateToAddress(ownerPrivateKey)).toLowerCase();
            
            token = await TestToken.new();
            smarWallet = await CustomSmartWallet.new();
            factory = await createCustomSmartWalletFactory(smarWallet);

            contractVerifier = await CustomSmartWalletDeployVerifier.new(factory.address);
            
            const env = await getTestingEnvironment();
            const chainId = env.chainId;

            //Request Data
            deployRequestData = {
            request: {
                relayHub: relayHub,
                to: constants.ZERO_ADDRESS,
                data: '0x',
                from: ownerAddress,
                nonce: senderNonce,
                value: '0',
                recoverer: recoverer,
                index: index,
                tokenContract: token.address,
                tokenAmount: tokensPaid.toString(),
                tokenGas: '50000'
            },
            relayData: {
                gasPrice,
                relayWorker,
                callForwarder: factory.address,
                callVerifier: contractVerifier.address,
                domainSeparator: getDomainSeparatorHash(factory.address, chainId)
            }
        };
        
            // Minting tokens to the smartwallet
            expectedAddress = await factory.getSmartWalletAddress(ownerAddress, recoverer, constants.ZERO_ADDRESS, soliditySha3Raw({ t: 'bytes', v: '0x' }), index);
            await token.mint(tokensPaid + 5, expectedAddress);
        });

        it('Should fail on Token contract not allowed of preRelayCall', async ()=> {
            await assert.isRejected(contractVerifier.verifyRelayedCall(deployRequestData, '0x00', { from: relayHub }), 'Token contract not allowed');
        });

        it('Should fail on Balance too low of preRelayCall', async () => {
            //Changing the initial params so the smart wallet address will be different to force NO balance
            deployRequestData.request.data = '0x01';
            deployRequestData.request.tokenAmount = (tokensPaid + 100).toString();
            
            await contractVerifier.acceptToken(token.address);
            
        await assert.isRejected(contractVerifier.verifyRelayedCall(deployRequestData, '0x00', { from: relayHub }), 'balance too low', 'Failed assert');
        });

        it('Should not fail on checks of preRelayCall', async () => {
            await contractVerifier.acceptToken(token.address);
            
            const rspSuccess = await contractVerifier.verifyRelayedCall(deployRequestData, '0x', { from: relayHub });
            assert.isEmpty(rspSuccess.logs, 'Call was NOT successfull');
            assert.isNotEmpty(rspSuccess.receipt, 'Call was NOT successfull');
        });
    });
});