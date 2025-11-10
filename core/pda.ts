import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SEEDS } from "../config/constants";
import bs58 from "bs58";

/**
 * Derive Mandate PDA
 * Seeds: [b"mandate", owner_pubkey, nonce_bytes]
 */
export function deriveMandatePDA(
  owner: PublicKey,
  nonce: anchor.BN,
  programId: PublicKey
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEEDS.MANDATE),
      owner.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
  return [pda, bump];
}

/**
 * Derive Ticket PDA (Redemption Receipt)
 * Seeds: [b"ticket", merchant_pubkey, allotment_pubkey, redemption_count]
 */
export function deriveTicketPDA(
  merchant: PublicKey,
  allotment: PublicKey,
  redemptionCount: anchor.BN,
  programId: PublicKey
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEEDS.TICKET),
      merchant.toBuffer(),
      allotment.toBuffer(),
      redemptionCount.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
  return [pda, bump];
}

/**
 * Derive Associated Token Account (vault for mandate)
 */
export async function deriveVaultATA(
  mandate: PublicKey,
  mint: PublicKey
): Promise<PublicKey> {
  const { getAssociatedTokenAddress } = await import("@solana/spl-token");
  
  return getAssociatedTokenAddress(
    mint,
    mandate,
    true // allowOwnerOffCurve (PDA can own ATAs)
  );
}

/**
 * Helper to generate a random nonce for mandate creation
 */
export function generateMandateNonce(): anchor.BN {
  return new anchor.BN(Date.now());
}

/**
 * Get all PDAs for a user (for querying)
 * Queries all MandateAccount accounts owned by the specified owner
 */
export async function getUserMandates(
  owner: PublicKey,
  programId: PublicKey,
  connection: anchor.web3.Connection
): Promise<PublicKey[]> {
  // MandateAccount structure:
  // Offset 0-7:   Discriminator (8 bytes)
  // Offset 8-39:   owner (PublicKey = 32 bytes)
  // Offset 40:     mandate_bump (u8 = 1 byte)
  // Offset 41-48: nonce (u64 = 8 bytes)
  // Offset 49-80: token_mint (PublicKey = 32 bytes)
  // Offset 81-112: vault (PublicKey = 32 bytes)
  // Offset 113-120: per_tx_limit (u64 = 8 bytes)
  // Offset 121-128: expiry (i64 = 8 bytes)
  // Offset 129:    paused (bool = 1 byte)
  // Offset 130-137: total_deposited (u64 = 8 bytes)
  // Total: 8 + 32 + 1 + 8 + 32 + 32 + 8 + 8 + 1 + 8 = 138 bytes
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        dataSize: 138, // Discriminator (8) + all MandateAccount fields (130)
      },
      {
        memcmp: {
          offset: 8, // After discriminator, owner field starts here
          // Encode raw bytes to base58 for RPC (RPC expects base58-encoded bytes, not public key string)
          bytes: bs58.encode(owner.toBytes()),
        },
      },
    ],
  });

  return accounts.map((account) => account.pubkey);
}

/**
 * Get all tickets for a merchant
 * Queries all RedemptionTicket accounts for the specified merchant
 */
export async function getMerchantTickets(
  merchant: PublicKey,
  programId: PublicKey,
  connection: anchor.web3.Connection
): Promise<PublicKey[]> {
  // RedemptionTicket structure:
  // Offset 0-7:   Discriminator (8 bytes)
  // Offset 8-39:  allotment (PublicKey = 32 bytes)
  // Offset 40-71: merchant (PublicKey = 32 bytes)
  // Offset 72-103: context_hash ([u8; 32] = 32 bytes)
  // Offset 104-111: amount (u64 = 8 bytes)
  // Offset 112-119: timestamp (i64 = 8 bytes)
  // Total: 8 + 32 + 32 + 32 + 8 + 8 = 120 bytes
  const ticketDataSize = 120; // Discriminator (8) + all RedemptionTicket fields (112)
  
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        dataSize: ticketDataSize,
      },
      {
        memcmp: {
          offset: 40, // After discriminator (8) + allotment (32) = 40, merchant field starts here
          // Encode raw bytes to base58 for RPC (RPC expects base58-encoded bytes, not public key string)
          bytes: bs58.encode(merchant.toBytes()),
        },
      },
    ],
  });

  return accounts.map((account) => account.pubkey);
}

