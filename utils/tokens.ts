import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import { Connection, Keypair, PublicKey } from "@solana/web3.js";

/**
 * Create a new SPL token mint
 */
export async function createTestToken(
  connection: Connection,
  payer: Keypair,
  decimals: number = 6
): Promise<PublicKey> {
  console.log("\n🪙 Creating test token...");
  
  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals
  );
  
  console.log(`✅ Token mint created: ${mint.toBase58()}`);
  return mint;
}

/**
 * Get or create associated token account
 */
export async function getOrCreateATA(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve: boolean = false
): Promise<PublicKey> {
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner,
    allowOwnerOffCurve
  );
  
  return ata.address;
}

/**
 * Mint tokens to an account
 */
export async function mintTokensTo(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  destination: PublicKey,
  amount: number
): Promise<string> {
  console.log(`\n💰 Minting ${amount / 1e6} tokens to ${destination.toBase58().slice(0, 16)}...`);
  
  const signature = await mintTo(
    connection,
    payer,
    mint,
    destination,
    payer,
    amount
  );
  
  console.log(`✅ Minted successfully`);
  return signature;
}

/**
 * Get token account balance
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  const account = await getAccount(connection, tokenAccount);
  return account.amount;
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: number | bigint, decimals: number = 6): string {
  const value = typeof amount === 'bigint' ? Number(amount) : amount;
  return (value / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Setup complete test environment with tokens
 */
export async function setupTestEnvironment(
  connection: Connection,
  payer: Keypair,
  users: Keypair[],
  initialAmount: number = 1000_000000,
  existingMint?: PublicKey
) {
  console.log("\n🔧 Setting up test environment...");
  
  // Use existing mint if provided, otherwise create new one
  let mint: PublicKey;
  if (existingMint) {
    mint = existingMint;
    console.log(`   Using existing mint: ${mint.toBase58()}`);
  } else {
    // Create test token
    mint = await createTestToken(connection, payer);
  }
  
  // Create token accounts for all users
  const tokenAccounts: PublicKey[] = [];
  
  for (const user of users) {
    const ata = await getOrCreateATA(
      connection,
      payer,
      mint,
      user.publicKey
    );
    tokenAccounts.push(ata);
    
    // Mint initial tokens
    await mintTokensTo(connection, payer, mint, ata, initialAmount);
  }
  
  console.log("✅ Test environment ready!");
  
  return {
    mint,
    tokenAccounts,
  };
}

