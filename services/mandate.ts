import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { deriveMandatePDA, deriveVaultATA, generateMandateNonce } from "../core/pda";

export interface MandateConfig {
  perTxLimit: number; // in token base units (e.g., 100_000000 for 100 USDC)
  expiryDays: number; // days from now
}

/**
 * Create a new mandate with vault
 */
export async function createMandate(
  program: anchor.Program,
  owner: PublicKey,
  mint: PublicKey,
  config: MandateConfig
): Promise<{ mandate: PublicKey; vault: PublicKey; nonce: anchor.BN; signature: string }> {
  console.log("\n📝 Creating mandate...");
  
  const nonce = generateMandateNonce();
  const [mandate, mandateBump] = deriveMandatePDA(owner, nonce, program.programId);
  const vault = await deriveVaultATA(mandate, mint);
  
  const perTxLimit = new anchor.BN(config.perTxLimit);
  const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + config.expiryDays * 86400);
  
  console.log(`   Mandate PDA: ${mandate.toBase58()}`);
  console.log(`   Vault: ${vault.toBase58()}`);
  console.log(`   Nonce: ${nonce.toString()}`);
  console.log(`   Per-tx limit: ${config.perTxLimit / 1e6} tokens`);
  console.log(`   Expiry: ${new Date((expiry.toNumber()) * 1000).toISOString()}`);
  
  const signature = await program.methods
    .createMandate(mandateBump, nonce, perTxLimit, expiry)
    .accounts({
      mandate,
      mint,
      vault,
      owner,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  
  console.log(`✅ Mandate created!`);
  console.log(`   TX: ${signature.slice(0, 16)}...`);
  
  return { mandate, vault, nonce, signature };
}

/**
 * Deposit tokens into mandate vault
 */
export async function depositToMandate(
  program: anchor.Program,
  mandate: PublicKey,
  fromTokenAccount: PublicKey,
  vault: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: number
): Promise<string> {
  console.log(`\n💰 Depositing ${amount / 1e6} tokens to mandate...`);
  
  const signature = await program.methods
    .deposit(new anchor.BN(amount))
    .accounts({
      mandate,
      from: fromTokenAccount,
      vault,
      mint,
      owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  
  console.log(`✅ Deposited successfully!`);
  console.log(`   TX: ${signature.slice(0, 16)}...`);
  
  return signature;
}

/**
 * Withdraw tokens from mandate vault
 */
export async function withdrawFromMandate(
  program: anchor.Program,
  mandate: PublicKey,
  vault: PublicKey,
  toTokenAccount: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  amount: number
): Promise<string> {
  console.log(`\n💸 Withdrawing ${amount / 1e6} tokens from mandate...`);
  
  const signature = await program.methods
    .withdraw(new anchor.BN(amount))
    .accounts({
      mandate,
      vault,
      to: toTokenAccount,
      mint,
      owner,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  
  console.log(`✅ Withdrawn successfully!`);
  console.log(`   TX: ${signature.slice(0, 16)}...`);
  
  return signature;
}

/**
 * Pause a mandate
 */
export async function pauseMandate(
  program: anchor.Program,
  mandate: PublicKey,
  owner: PublicKey
): Promise<string> {
  console.log("\n⏸️  Pausing mandate...");
  
  const signature = await program.methods
    .pauseMandate()
    .accounts({
      mandate,
      owner,
    })
    .rpc();
  
  console.log(`✅ Mandate paused!`);
  return signature;
}

/**
 * Resume a paused mandate
 */
export async function resumeMandate(
  program: anchor.Program,
  mandate: PublicKey,
  owner: PublicKey
): Promise<string> {
  console.log("\n▶️  Resuming mandate...");
  
  const signature = await program.methods
    .resumeMandate()
    .accounts({
      mandate,
      owner,
    })
    .rpc();
  
  console.log(`✅ Mandate resumed!`);
  return signature;
}

/**
 * Fetch mandate account data
 */
export async function fetchMandate(
  program: anchor.Program,
  mandate: PublicKey
): Promise<any> {
  return await (program.account as any).mandateAccount.fetch(mandate);
}

/**
 * Display mandate info
 */
export function displayMandateInfo(mandate: any) {
  console.log("\n📋 Mandate Info:");
  console.log(`   Owner: ${mandate.owner.toBase58()}`);
  console.log(`   Token Mint: ${mandate.tokenMint.toBase58()}`);
  console.log(`   Vault: ${mandate.vault.toBase58()}`);
  console.log(`   Per-tx Limit: ${mandate.perTxLimit.toNumber() / 1e6} tokens`);
  console.log(`   Total Deposited: ${mandate.totalDeposited.toNumber() / 1e6} tokens`);
  console.log(`   Paused: ${mandate.paused}`);
  console.log(`   Expiry: ${new Date(mandate.expiry.toNumber() * 1000).toISOString()}`);
}

