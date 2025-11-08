import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SEEDS } from "../config/constants";

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
 * Seeds: [b"ticket", merchant_pubkey, allotment_pubkey]
 */
export function deriveTicketPDA(
  merchant: PublicKey,
  allotment: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(SEEDS.TICKET),
      merchant.toBuffer(),
      allotment.toBuffer(),
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
 */
export async function getUserMandates(
  owner: PublicKey,
  programId: PublicKey,
  connection: anchor.web3.Connection
): Promise<PublicKey[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: owner.toBase58(),
        },
      },
    ],
  });

  return accounts.map((account) => account.pubkey);
}

/**
 * Get all tickets for a merchant
 */
export async function getMerchantTickets(
  merchant: PublicKey,
  programId: PublicKey,
  connection: anchor.web3.Connection
): Promise<PublicKey[]> {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 40, // 8 (discriminator) + 32 (allotment) = 40
          bytes: merchant.toBase58(),
        },
      },
    ],
  });

  return accounts.map((account) => account.pubkey);
}

