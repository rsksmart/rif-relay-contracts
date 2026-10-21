import {
  BigNumber,
  BigNumberish,
  Signature,
  Wallet,
  constants,
  utils,
} from 'ethers';

// redeemAndExecute(bytes32,uint256,address,uint256,(address,uint256,bytes)[],address,uint256,address,uint8,bytes32,bytes32)
// on the HTLCNativeCoordinator: runs calls chosen by the request, never accepted
export const REDEEM_AND_EXECUTE_SELECTOR = '0x81838615';

export const HTLC_NATIVE_ABI = [
  'function redeem(bytes32 preimage, uint256 amount, address sender, uint256 timelock)',
  'function redeemBySig(bytes32 preimage, uint256 amount, address sender, uint256 timelock, address destination, address sweepToken, uint256 minAmountOut, bytes32 callsHash, uint8 v, bytes32 r, bytes32 s) returns (address)',
  'function refund(bytes32 preimageHash, uint256 amount, address claimAddress, uint256 timelock, address destination)',
  'function isActive(bytes32 preimageHash, uint256 amount, address token, address sender, address claimAddress, uint256 timelock) view returns (bool)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
];

const htlcInterface = new utils.Interface(HTLC_NATIVE_ABI);

const REDEEM_TYPES = {
  Redeem: [
    { name: 'preimage', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'sender', type: 'address' },
    { name: 'timelock', type: 'uint256' },
    { name: 'caller', type: 'address' },
    { name: 'destination', type: 'address' },
    { name: 'sweepToken', type: 'address' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'callsHash', type: 'bytes32' },
  ],
};

export type SwapTerms = {
  preimage: string;
  amount: BigNumber;
  sender: string;
  timelock: BigNumber;
};

export type RedeemAuthorization = {
  caller: string;
  destination: string;
  sweepToken: string;
  minAmountOut: BigNumberish;
  callsHash: string;
};

export const createSwapTerms = (
  overrides: Partial<SwapTerms> = {}
): SwapTerms => ({
  preimage: utils.hexlify(utils.randomBytes(32)),
  amount: utils.parseEther('0.5'),
  sender: Wallet.createRandom().address,
  timelock: BigNumber.from(500),
  ...overrides,
});

export const getPreimageHash = (preimage: string) => utils.sha256(preimage);

// The hash of an empty calls array, as signed when nothing runs after the redeem
export const EMPTY_CALLS_HASH = utils.keccak256(
  utils.defaultAbiCoder.encode(
    ['tuple(address target, uint256 value, bytes callData)[]'],
    [[]]
  )
);

const getDomain = (htlcAddress: string, chainId: number) => ({
  name: 'HTLCNative',
  version: '1',
  chainId,
  verifyingContract: htlcAddress,
});

export const getDomainSeparator = (htlcAddress: string, chainId: number) =>
  utils._TypedDataEncoder.hashDomain(getDomain(htlcAddress, chainId));

export const signRedeem = async (
  signer: Wallet,
  htlcAddress: string,
  chainId: number,
  terms: SwapTerms,
  authorization: RedeemAuthorization
) =>
  utils.splitSignature(
    await signer._signTypedData(getDomain(htlcAddress, chainId), REDEEM_TYPES, {
      ...terms,
      ...authorization,
    })
  );

export const encodeRedeem = ({
  preimage,
  amount,
  sender,
  timelock,
}: SwapTerms) =>
  htlcInterface.encodeFunctionData('redeem', [
    preimage,
    amount,
    sender,
    timelock,
  ]);

export const encodeRedeemBySig = (
  { preimage, amount, sender, timelock }: SwapTerms,
  { destination, sweepToken, minAmountOut, callsHash }: RedeemAuthorization,
  { v, r, s }: Signature
) =>
  htlcInterface.encodeFunctionData('redeemBySig', [
    preimage,
    amount,
    sender,
    timelock,
    destination,
    sweepToken,
    minAmountOut,
    callsHash,
    v,
    r,
    s,
  ]);

/**
 * A refund of an expired swap paid to `destination`: an HTLCNative method a
 * swap smart wallet must not relay, since the destination runs code when paid.
 */
export const encodeRefundTo = (
  { preimage, amount, sender, timelock }: SwapTerms,
  destination: string
) =>
  htlcInterface.encodeFunctionData('refund', [
    getPreimageHash(preimage),
    amount,
    sender,
    timelock,
    destination,
  ]);

export const createRedeemAuthorization = (
  overrides: Partial<RedeemAuthorization> = {}
): RedeemAuthorization => ({
  caller: constants.AddressZero,
  destination: constants.AddressZero,
  sweepToken: constants.AddressZero,
  minAmountOut: 0,
  callsHash: EMPTY_CALLS_HASH,
  ...overrides,
});

export type RedeemMethod = 'redeem' | 'redeemBySig';

export const REDEEM_METHODS: RedeemMethod[] = ['redeem', 'redeemBySig'];

type RedeemRequestArgs = {
  method: RedeemMethod;
  htlcAddress: string;
  smartWalletAddress: string;
  chainId: number;
  claimant?: Wallet;
  terms?: SwapTerms;
  authorization?: Partial<RedeemAuthorization>;
};

export type RedeemRequest = {
  to: string;
  data: string;
  terms: SwapTerms;
  claimAddress: string;
};

/**
 * Build the `to` and `data` of a request that redeems a swap into the smart wallet,
 * along with the claimAddress the swap must have been created with.
 */
export const createRedeemRequest = async ({
  method,
  htlcAddress,
  smartWalletAddress,
  chainId,
  claimant = Wallet.createRandom(),
  terms = createSwapTerms(),
  authorization = {},
}: RedeemRequestArgs): Promise<RedeemRequest> => {
  switch (method) {
    case 'redeem':
      return {
        to: htlcAddress,
        data: encodeRedeem(terms),
        terms,
        claimAddress: smartWalletAddress,
      };
    case 'redeemBySig': {
      const redeemAuthorization = createRedeemAuthorization({
        caller: smartWalletAddress,
        destination: smartWalletAddress,
        ...authorization,
      });
      const signature = await signRedeem(
        claimant,
        htlcAddress,
        chainId,
        terms,
        redeemAuthorization
      );

      return {
        to: htlcAddress,
        data: encodeRedeemBySig(terms, redeemAuthorization, signature),
        terms,
        claimAddress: claimant.address,
      };
    }
  }
};
