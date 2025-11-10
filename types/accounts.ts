import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

/**
 * MandateAccount - Stores mandate configuration and state
 * 
 * A mandate represents a user's authorization for delegated payments.
 * It contains the vault (ATA) where funds are stored and spending limits.
 */
export interface MandateAccount {
  /** Owner of the mandate (the user who created it) */
  owner: PublicKey;
  /** Bump seed for the mandate PDA */
  mandateBump: number;
  /** Nonce used to derive the mandate PDA */
  nonce: anchor.BN;
  /** Token mint address (e.g., USDC) */
  tokenMint: PublicKey;
  /** Vault ATA address (where tokens are stored) */
  vault: PublicKey;
  /** Maximum amount per transaction (in token base units) */
  perTxLimit: anchor.BN;
  /** Expiry timestamp (Unix timestamp in seconds) */
  expiry: anchor.BN;
  /** Whether the mandate is paused */
  paused: boolean;
  /** Total amount deposited into the vault (cumulative) */
  totalDeposited: anchor.BN;
}

/**
 * AllotmentAccount - Stores agent spending limits and usage
 * 
 * An allotment authorizes a specific agent to spend up to a certain amount
 * from a mandate within a time-to-live (TTL) period.
 */
export interface AllotmentAccount {
  /** The mandate this allotment belongs to */
  mandate: PublicKey;
  /** The agent authorized to spend from this allotment */
  agent: PublicKey;
  /** Maximum amount the agent can spend (in token base units) */
  allowedAmount: anchor.BN;
  /** Amount already spent by the agent (in token base units) */
  spentAmount: anchor.BN;
  /** Time-to-live: expiry timestamp (Unix timestamp in seconds) */
  ttl: anchor.BN;
  /** Whether this allotment has been revoked */
  revoked: boolean;
  /** Number of redemptions made from this allotment */
  redemptionCount: anchor.BN;
}

/**
 * RedemptionTicket - On-chain proof of payment
 * 
 * Created when an agent redeems an allotment to pay a merchant.
 * Merchants can query these tickets to verify payments independently.
 */
export interface RedemptionTicket {
  /** The allotment that was redeemed */
  allotment: PublicKey;
  /** The merchant who received the payment */
  merchant: PublicKey;
  /** SHA256 hash of order/context data (32 bytes) */
  contextHash: number[];
  /** Amount paid (in token base units) */
  amount: anchor.BN;
  /** Timestamp when payment was executed (Unix timestamp in seconds) */
  timestamp: anchor.BN;
}

/**
 * RedeemEvent - Event emitted when a payment is executed
 * 
 * This event is emitted on-chain when an agent redeems an allotment.
 * Merchants can listen for these events to detect new payments.
 */
export interface RedeemEvent {
  /** The allotment that was redeemed */
  allotment: PublicKey;
  /** The merchant who received the payment */
  merchant: PublicKey;
  /** The agent who executed the payment */
  agent: PublicKey;
  /** SHA256 hash of order/context data (32 bytes) */
  contextHash: number[];
  /** Amount paid (in token base units) */
  amount: anchor.BN;
  /** Timestamp when payment was executed (Unix timestamp in seconds) */
  timestamp: anchor.BN;
}

/**
 * AllotmentStatus - Status of an allotment
 */
export type AllotmentStatus = 
  | "active"        // Allotment is active and can be used
  | "revoked"       // Allotment has been revoked by owner
  | "expired"       // Allotment has passed its TTL
  | "fully_spent";  // Allotment has been fully spent

/**
 * MandateStatus - Status of a mandate
 */
export type MandateStatus =
  | "active"   // Mandate is active and operational
  | "paused"   // Mandate is paused (no allotments/redeems allowed)
  | "expired"; // Mandate has passed its expiry date

