import {
  FakeContract,
  MockContract,
  MockContractFactory,
  smock,
} from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { constants } from 'ethers';
import { ethers } from 'hardhat';
import {
  MinimalBoltzDeployVerifier,
  MinimalBoltzDeployVerifier__factory,
  ERC20,
  MinimalBoltzSmartWalletFactory,
  MinimalBoltzSmartWallet__factory,
  NativeSwap,
} from 'typechain-types';
import { EnvelopingTypes, RelayHub } from 'typechain-types/contracts/RelayHub';

chai.use(smock.matchers);
chai.use(chaiAsPromised);

describe('MinimalBoltzDeployVerifier Contract', function () {
  let fakeToken: FakeContract<ERC20>;
  let fakeContract: FakeContract<ERC20>;
  let fakeWalletFactory: FakeContract<MinimalBoltzSmartWalletFactory>;
  let deployVerifierFactoryMock: MockContractFactory<MinimalBoltzDeployVerifier__factory>;
  let deployVerifierMock: MockContract<MinimalBoltzDeployVerifier>;

  beforeEach(async function () {
    fakeToken = await smock.fake<ERC20>('ERC20');
    fakeContract = await smock.fake<ERC20>('ERC20');
    fakeWalletFactory = await smock.fake<MinimalBoltzSmartWalletFactory>(
      'MinimalBoltzSmartWalletFactory'
    );
    deployVerifierFactoryMock =
      await smock.mock<MinimalBoltzDeployVerifier__factory>(
        'MinimalBoltzDeployVerifier'
      );
    deployVerifierMock = await deployVerifierFactoryMock.deploy(
      fakeWalletFactory.address
    );
  });

  describe('constructor', function () {
    it('Should deploy', async function () {
      const deployVerifier = deployVerifierFactoryMock.deploy(
        fakeWalletFactory.address
      );

      await expect(deployVerifier).to.not.be.reverted;
    });
  });

  describe('versionVerifier()', function () {
    it('should get the current version', async function () {
      const version = await deployVerifierMock.versionVerifier();
      expect(version).to.eq('rif.enveloping.token.iverifier@2.0.1');
    });
  });

  describe('DestinationContractHandler', function () {
    describe('acceptContract', function () {
      it('should set a contract address in the acceptedContracts list', async function () {
        await deployVerifierMock.acceptContract(fakeContract.address);
        const acceptsContract = await deployVerifierMock.acceptsContract(
          fakeContract.address
        );
        expect(acceptsContract).to.be.true;
      });

      it('should revert if address is not a contract', async function () {
        const eoa = ethers.Wallet.createRandom().address;
        const result = deployVerifierMock.acceptContract(eoa);
        await expect(result).to.be.revertedWith('Address is not a contract');
      });

      it('should revert if contract is already in the acceptedContracts list', async function () {
        await deployVerifierMock.setVariable('contracts', {
          [fakeContract.address]: true,
        });
        const result = deployVerifierMock.acceptContract(fakeContract.address);
        await expect(result).to.be.revertedWith('Contract is already accepted');
      });

      it('should revert if caller is not the owner', async function () {
        const [other] = (await ethers.getSigners()).slice(1) as [
          SignerWithAddress
        ];

        await expect(
          deployVerifierMock.connect(other).acceptContract(fakeContract.address)
        ).to.be.revertedWith('Caller is not the owner');
      });
    });

    describe('removeContract', function () {
      it('should remove a contract from contracts map', async function () {
        await deployVerifierMock.setVariables({
          contracts: {
            [fakeContract.address]: true,
          },
          acceptedContracts: [ethers.utils.getAddress(fakeContract.address)],
        });

        await deployVerifierMock.removeContract(fakeContract.address, 0);

        const contractMapValue = (await deployVerifierMock.getVariable(
          'contracts',
          [fakeContract.address]
        )) as boolean;

        expect(contractMapValue).to.be.false;
      });

      it('should remove a contract from acceptedContracts array', async function () {
        await deployVerifierMock.setVariables({
          contracts: {
            [fakeContract.address]: true,
          },
          acceptedContracts: [fakeContract.address],
        });

        await deployVerifierMock.removeContract(fakeContract.address, 0);

        const acceptedContracts =
          await deployVerifierMock.getAcceptedContracts();

        expect(acceptedContracts).to.not.contain(fakeContract.address);
      });

      it('should revert if contract is not currently previously accepted', async function () {
        const result = deployVerifierMock.removeContract(
          fakeContract.address,
          0
        );

        await expect(result).to.be.revertedWith('Contract is not accepted');
      });

      it('should revert if contract index does not correspond to contract address to be removed', async function () {
        const fakeContract1 = await smock.fake<ERC20>('ERC20');

        await deployVerifierMock.setVariables({
          contracts: {
            [fakeContract.address]: true,
            [fakeContract1.address]: true,
          },
          acceptedContracts: [fakeContract.address, fakeContract1.address],
        });

        const result = deployVerifierMock.removeContract(
          fakeContract.address,
          1
        );
        await expect(result).to.be.revertedWith('Wrong contract index');
      });

      it('should revert if caller is not the owner', async function () {
        const [other] = (await ethers.getSigners()).slice(1) as [
          SignerWithAddress
        ];

        await expect(
          deployVerifierMock.connect(other).acceptContract(fakeContract.address)
        ).to.be.revertedWith('Caller is not the owner');
      });
    });

    describe('getAcceptedContracts()', function () {
      it('should get all the accepted contracts', async function () {
        const fakeContractList = [fakeContract.address];
        await deployVerifierMock.setVariable(
          'acceptedContracts',
          fakeContractList
        );

        const acceptedContracts =
          await deployVerifierMock.getAcceptedContracts();
        expect(acceptedContracts).to.deep.equal(fakeContractList);
      });
    });

    describe('acceptsContract()', function () {
      beforeEach(async function () {
        const { address } = fakeContract;
        await deployVerifierMock.setVariable('contracts', {
          [address]: true,
        });
      });

      it('should return true if contract is accepted', async function () {
        const acceptsContract = await deployVerifierMock.acceptsContract(
          fakeContract.address
        );
        expect(acceptsContract).to.be.true;
      });

      it('should return false if contract is not accepted', async function () {
        const fakeContractUnaccepted = await smock.fake<ERC20>('ERC20');
        const acceptsContract = await deployVerifierMock.acceptsContract(
          fakeContractUnaccepted.address
        );
        expect(acceptsContract).to.be.false;
      });
    });
  });

  describe('verifyRelayedCall()', function () {
    let owner: SignerWithAddress;
    let fakeSwap: FakeContract<NativeSwap>;
    let relayWorker: SignerWithAddress;
    let fakeRelayHub: FakeContract<RelayHub>;

    beforeEach(async function () {
      [owner, relayWorker] = (await ethers.getSigners()) as [
        SignerWithAddress,
        SignerWithAddress
      ];
      fakeRelayHub = await smock.fake<RelayHub>('RelayHub');
      fakeSwap = await smock.fake<NativeSwap>('NativeSwap');

      await deployVerifierMock.setVariables({
        acceptedContracts: [fakeSwap.address],
        contracts: {
          [fakeSwap.address]: true,
        },
      });
    });

    it('should revert if destination contract is not allowed', async function () {
      await deployVerifierMock.setVariable('contracts', {
        [fakeSwap.address]: false,
      });

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: fakeSwap.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.rejectedWith(
        'Destination contract not allowed'
      );
    });

    it('should revert if factory address in request is different than factory address in contract', async function () {
      const differentFactoryFake = await smock.fake(
        'MinimalBoltzSmartWalletFactory'
      );

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: differentFactoryFake.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: fakeSwap.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Invalid factory');
    });

    it('should revert if Smart Wallet is already created', async function () {
      const fakeSmartWalletFactory =
        await smock.mock<MinimalBoltzSmartWallet__factory>(
          'MinimalBoltzSmartWallet'
        );
      const mockSmartWallet = await fakeSmartWalletFactory.deploy();

      fakeWalletFactory.getSmartWalletAddress.returns(mockSmartWallet.address);

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data: '0x00',
          from: owner.address,
          to: fakeSwap.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000000000',
          tokenContract: fakeToken.address,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Address already created');
    });

    it('should revert if method is not allowed', async function () {
      const smartWalletAddress = ethers.Wallet.createRandom().address;
      fakeWalletFactory.getSmartWalletAddress.returns(smartWalletAddress);

      const ABI = [
        'function claim(bytes32 preimage, uint amount, address claimAddress)',
      ];
      const abiInterface = new ethers.utils.Interface(ABI);
      const data = abiInterface.encodeFunctionData('claim', [
        constants.HashZero,
        ethers.utils.parseEther('0.5'),
        constants.AddressZero,
      ]);

      const deployRequest: EnvelopingTypes.DeployRequestStruct = {
        relayData: {
          callForwarder: fakeWalletFactory.address,
          callVerifier: deployVerifierMock.address,
          gasPrice: '10',
          feesReceiver: relayWorker.address,
        },
        request: {
          recoverer: constants.AddressZero,
          index: '0',
          data,
          from: owner.address,
          to: fakeSwap.address,
          nonce: '0',
          tokenGas: '50000',
          relayHub: fakeRelayHub.address,
          tokenAmount: '100000',
          tokenContract: constants.AddressZero,
          validUntilTime: '0',
          value: '0',
        },
      };

      const result = deployVerifierMock.verifyRelayedCall(
        deployRequest,
        '0x00'
      );
      await expect(result).to.be.revertedWith('Method not allowed');
    });

    describe('calling claim', function () {
      type ClaimMethodType = 'public' | 'external';

      function testClaimMethodType(method: ClaimMethodType) {
        describe(`${method} method`, function () {
          let data: string;
          let smartWalletAddress: string;

          beforeEach(function () {
            fakeSwap.swaps.returns(true);
            const ABI = [
              'function claim(bytes32 preimage, uint amount, address claimAddress, address refundAddress, uint timelock)',
              'function claim(bytes32 preimage, uint amount, address refundAddress, uint timelock)',
            ];
            const abiInterface = new ethers.utils.Interface(ABI);
            smartWalletAddress = ethers.Wallet.createRandom().address;
            switch (method) {
              case 'external':
                data = abiInterface.encodeFunctionData(
                  'claim(bytes32,uint256,address,uint256)',
                  [
                    constants.HashZero,
                    ethers.utils.parseEther('0.5'),
                    smartWalletAddress,
                    500,
                  ]
                );
                break;
              case 'public':
                data = abiInterface.encodeFunctionData(
                  'claim(bytes32,uint256,address,address,uint256)',
                  [
                    constants.HashZero,
                    ethers.utils.parseEther('0.5'),
                    smartWalletAddress,
                    constants.AddressZero,
                    500,
                  ]
                );
                break;
            }
          });

          it('should revert if native balance is too low', async function () {
            const deployRequest: EnvelopingTypes.DeployRequestStruct = {
              relayData: {
                callForwarder: fakeWalletFactory.address,
                callVerifier: deployVerifierMock.address,
                gasPrice: '10',
                feesReceiver: relayWorker.address,
              },
              request: {
                recoverer: constants.AddressZero,
                index: '0',
                data,
                from: owner.address,
                to: fakeSwap.address,
                nonce: '0',
                tokenGas: '50000',
                relayHub: fakeRelayHub.address,
                tokenAmount: ethers.utils.parseEther('1'),
                tokenContract: constants.AddressZero,
                validUntilTime: '0',
                value: '0',
              },
            };

            const result = deployVerifierMock.verifyRelayedCall(
              deployRequest,
              '0x00'
            );
            await expect(result).to.be.revertedWith('Native balance too low');
          });

          it('should revert if swap contract cannot pay for the native fee', async function () {
            fakeWalletFactory.getSmartWalletAddress.returns(smartWalletAddress);
            fakeSwap.swaps.returns(false);

            const deployRequest: EnvelopingTypes.DeployRequestStruct = {
              relayData: {
                callForwarder: fakeWalletFactory.address,
                callVerifier: deployVerifierMock.address,
                gasPrice: '10',
                feesReceiver: relayWorker.address,
              },
              request: {
                recoverer: constants.AddressZero,
                index: '0',
                data,
                from: owner.address,
                to: fakeSwap.address,
                nonce: '0',
                tokenGas: '50000',
                relayHub: fakeRelayHub.address,
                tokenAmount: ethers.utils.parseEther('0.5'),
                tokenContract: constants.AddressZero,
                validUntilTime: '0',
                value: '0',
              },
            };

            const result = deployVerifierMock.verifyRelayedCall(
              deployRequest,
              '0x00'
            );
            await expect(result).to.be.revertedWith(
              'Verifier: swap has no RBTC'
            );
          });

          it('should not revert if swap contract can pay for the native fee', async function () {
            fakeWalletFactory.getSmartWalletAddress.returns(smartWalletAddress);

            const deployRequest: EnvelopingTypes.DeployRequestStruct = {
              relayData: {
                callForwarder: fakeWalletFactory.address,
                callVerifier: deployVerifierMock.address,
                gasPrice: '10',
                feesReceiver: relayWorker.address,
              },
              request: {
                recoverer: constants.AddressZero,
                index: '0',
                data,
                from: owner.address,
                to: fakeSwap.address,
                nonce: '0',
                tokenGas: '50000',
                relayHub: fakeRelayHub.address,
                tokenAmount: ethers.utils.parseEther('0.5'),
                tokenContract: constants.AddressZero,
                validUntilTime: '0',
                value: '0',
              },
            };

            const result = deployVerifierMock.verifyRelayedCall(
              deployRequest,
              '0x00'
            );
            await expect(result).to.not.be.reverted;
          });

          it('should not revert if not paying', async function () {
            const deployRequest: EnvelopingTypes.DeployRequestStruct = {
              relayData: {
                callForwarder: fakeWalletFactory.address,
                callVerifier: deployVerifierMock.address,
                gasPrice: '10',
                feesReceiver: relayWorker.address,
              },
              request: {
                recoverer: constants.AddressZero,
                index: '0',
                data,
                from: owner.address,
                to: fakeSwap.address,
                nonce: '0',
                tokenGas: '50000',
                relayHub: fakeRelayHub.address,
                tokenAmount: '0',
                tokenContract: constants.AddressZero,
                validUntilTime: '0',
                value: '0',
              },
            };

            const result = deployVerifierMock.verifyRelayedCall(
              deployRequest,
              '0x00'
            );

            await expect(result).to.not.be.reverted;
          });
        });
      }

      // Using [dynamically generated tests](https://mochajs.org/#dynamically-generating-tests)
      // we needs the mocha/no-setup-in-describe rule to be disabled
      // see: https://github.com/lo1tuma/eslint-plugin-mocha/blob/main/docs/rules/no-setup-in-describe.md#disallow-setup-in-describe-blocks-mochano-setup-in-describe
      // eslint-disable-next-line mocha/no-setup-in-describe
      testClaimMethodType('public');
      // eslint-disable-next-line mocha/no-setup-in-describe
      testClaimMethodType('external');
    });
  });
});
