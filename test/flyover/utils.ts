import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';

export const REGISTER_PEGIN_SELECTOR = '0x3823c753';

export const PEGIN_QUOTE_NAMED_TUPLE =
  'tuple(uint256 chainId,uint256 callFee,uint256 penaltyFee,uint256 value,uint256 gasFee,bytes20 fedBtcAddress,address lbcAddress,address liquidityProviderRskAddress,address contractAddress,address rskRefundAddress,int64 nonce,uint32 gasLimit,uint32 agreementTimestamp,uint32 timeForDeposit,uint32 callTime,uint16 depositConfirmations,bool callOnRegister,bytes btcRefundAddress,bytes liquidityProviderBtcAddress,bytes data)';

export const PEGIN_FAKE_ABI = [
  `function hashPegInQuote(${PEGIN_QUOTE_NAMED_TUPLE} quote) external view returns (bytes32)`,
  'function getQuoteStatus(bytes32 quoteHash) external view returns (uint8)',
  `function registerPegIn(${PEGIN_QUOTE_NAMED_TUPLE} quote,bytes signature,bytes btcRawTransaction,bytes partialMerkleTree,uint256 height) external returns (int256)`,
];

export type FlyoverPegInQuote = {
  chainId: number;
  callFee: string;
  penaltyFee: string;
  value: string;
  gasFee: string;
  fedBtcAddress: string;
  lbcAddress: string;
  liquidityProviderRskAddress: string;
  contractAddress: string;
  rskRefundAddress: string;
  nonce: number;
  gasLimit: number;
  agreementTimestamp: number;
  timeForDeposit: number;
  callTime: number;
  depositConfirmations: number;
  callOnRegister: boolean;
  btcRefundAddress: string;
  liquidityProviderBtcAddress: string;
  data: string;
};

const BTC_ADDRESS_BYTES = `0x${'00'.repeat(21)}`;

export const createFlyoverPegInQuote = (
  pegInContract: string,
  chainId: number,
  overrides: Partial<FlyoverPegInQuote> = {}
): FlyoverPegInQuote => ({
  chainId,
  callFee: '0',
  penaltyFee: utils.parseEther('0.01').toString(),
  value: '0',
  gasFee: '0',
  fedBtcAddress: `0x${'00'.repeat(20)}`,
  lbcAddress: pegInContract,
  liquidityProviderRskAddress: constants.AddressZero,
  contractAddress: constants.AddressZero,
  rskRefundAddress: constants.AddressZero,
  nonce: 1,
  gasLimit: 35000,
  agreementTimestamp: Math.floor(Date.now() / 1000),
  timeForDeposit: 3600,
  callTime: 3600,
  depositConfirmations: 2,
  callOnRegister: false,
  btcRefundAddress: BTC_ADDRESS_BYTES,
  liquidityProviderBtcAddress: BTC_ADDRESS_BYTES,
  data: '0x',
  ...overrides,
});

const registerPegInInterface = new utils.Interface([
  `function registerPegIn(${PEGIN_QUOTE_NAMED_TUPLE} quote,bytes signature,bytes btcRawTransaction,bytes partialMerkleTree,uint256 height)`,
]);

export const encodeRegisterPegIn = (
  quote: FlyoverPegInQuote,
  height = 100
): string =>
  registerPegInInterface.encodeFunctionData('registerPegIn', [
    [
      quote.chainId,
      quote.callFee,
      quote.penaltyFee,
      quote.value,
      quote.gasFee,
      quote.fedBtcAddress,
      quote.lbcAddress,
      quote.liquidityProviderRskAddress,
      quote.contractAddress,
      quote.rskRefundAddress,
      quote.nonce,
      quote.gasLimit,
      quote.agreementTimestamp,
      quote.timeForDeposit,
      quote.callTime,
      quote.depositConfirmations,
      quote.callOnRegister,
      quote.btcRefundAddress,
      quote.liquidityProviderBtcAddress,
      quote.data,
    ],
    '0x01',
    '0x0101',
    '0x0202',
    height,
  ]);

export const toQuoteTuple = (quote: FlyoverPegInQuote) => [
  quote.chainId,
  quote.callFee,
  quote.penaltyFee,
  quote.value,
  quote.gasFee,
  quote.fedBtcAddress,
  quote.lbcAddress,
  quote.liquidityProviderRskAddress,
  quote.contractAddress,
  quote.rskRefundAddress,
  quote.nonce,
  quote.gasLimit,
  quote.agreementTimestamp,
  quote.timeForDeposit,
  quote.callTime,
  quote.depositConfirmations,
  quote.callOnRegister,
  quote.btcRefundAddress,
  quote.liquidityProviderBtcAddress,
  quote.data,
];

export const hashFlyoverPegInQuote = (quote: FlyoverPegInQuote): string =>
  ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      [PEGIN_QUOTE_NAMED_TUPLE],
      [
        {
          chainId: quote.chainId,
          callFee: quote.callFee,
          penaltyFee: quote.penaltyFee,
          value: quote.value,
          gasFee: quote.gasFee,
          fedBtcAddress: quote.fedBtcAddress,
          lbcAddress: quote.lbcAddress,
          liquidityProviderRskAddress: quote.liquidityProviderRskAddress,
          contractAddress: quote.contractAddress,
          rskRefundAddress: quote.rskRefundAddress,
          nonce: quote.nonce,
          gasLimit: quote.gasLimit,
          agreementTimestamp: quote.agreementTimestamp,
          timeForDeposit: quote.timeForDeposit,
          callTime: quote.callTime,
          depositConfirmations: quote.depositConfirmations,
          callOnRegister: quote.callOnRegister,
          btcRefundAddress: quote.btcRefundAddress,
          liquidityProviderBtcAddress: quote.liquidityProviderBtcAddress,
          data: quote.data,
        },
      ]
    )
  );
