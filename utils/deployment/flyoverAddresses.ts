import { HardhatEthersHelpers } from 'hardhat/types';



export const getFlyoverContractAddresses = async (
  ethers: HardhatEthersHelpers
): Promise<{ pegInContract: string; collateralManagement: string }> => {
  const { chainId } = await ethers.provider.getNetwork();

  const pegInContractRaw = process.env['PEGIN_CONTRACT_ADDRESS'] ?? '';
  const collateralManagementRaw =
    process.env['COLLATERAL_MANAGEMENT_ADDRESS'] ?? '';

  if (!pegInContractRaw || !collateralManagementRaw) {
    throw new Error(
      `Flyover deployment requires PEGIN_CONTRACT_ADDRESS and COLLATERAL_MANAGEMENT_ADDRESS for chainId ${chainId}`
    );
  }

  if (
    !ethers.utils.isAddress(pegInContractRaw) ||
    !ethers.utils.isAddress(collateralManagementRaw)
  ) {
    throw new Error(
      `Invalid Flyover addresses for chainId ${chainId} (PEGIN_CONTRACT_ADDRESS=${pegInContractRaw}, COLLATERAL_MANAGEMENT_ADDRESS=${collateralManagementRaw})`
    );
  }

  return {
    pegInContract: ethers.utils.getAddress(pegInContractRaw),
    collateralManagement: ethers.utils.getAddress(collateralManagementRaw),
  };
};
