import { PublicKey } from "@solana/web3.js";

/**
 * AugenPay Program Configuration
 */
export const AUGENPAY_PROGRAM_ID = new PublicKey(
  "6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp"
);

/**
 * Cluster endpoints
 */
export const CLUSTER_ENDPOINTS = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  localnet: "http://localhost:8899",
} as const;

/**
 * Default cluster
 */
export const DEFAULT_CLUSTER = "devnet";

/**
 * Devnet USDC mint (for testing)
 * You can create your own test token or use this
 */
export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // Devnet USDC (circle)
);

/**
 * PDA Seeds
 */
export const SEEDS = {
  MANDATE: "mandate",
  TICKET: "ticket",
} as const;

/**
 * Default transaction confirmation commitment
 */
export const COMMITMENT = "confirmed";

/**
 * Default mandate configuration
 */
export const DEFAULT_MANDATE_CONFIG = {
  perTxLimit: 100_000000, // 100 USDC (6 decimals)
  expiryDays: 30, // 30 days from now
};

/**
 * Default allotment configuration
 */
export const DEFAULT_ALLOTMENT_CONFIG = {
  allowedAmount: 200_000000, // 200 USDC
  ttlHours: 24, // 24 hours
};

