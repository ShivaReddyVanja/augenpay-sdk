import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { AllotmentAccount, AllotmentStatus } from "../types/accounts";

export interface AllotmentConfig {
  allowedAmount: number; // in token base units
  ttlHours: number; // hours from now
}

/**
 * Create an allotment for an agent
 */
export async function createAllotment(
  program: anchor.Program,
  mandate: PublicKey,
  agent: PublicKey,
  owner: PublicKey,
  config: AllotmentConfig
): Promise<{ allotment: PublicKey; signature: string }> {
  console.log("\n🎫 Creating allotment for agent...");
  console.log(`   Agent: ${agent.toBase58()}`);
  console.log(`   Allowed: ${config.allowedAmount / 1e6} tokens`);
  console.log(`   TTL: ${config.ttlHours} hours`);
  
  const allotmentKeypair = Keypair.generate();
  const allowedAmount = new anchor.BN(config.allowedAmount);
  const ttl = new anchor.BN(Math.floor(Date.now() / 1000) + config.ttlHours * 3600);
  
  const signature = await program.methods
    .createAllotment(allowedAmount, ttl)
    .accounts({
      mandate,
      allotment: allotmentKeypair.publicKey,
      owner,
      agent,
      systemProgram: SystemProgram.programId,
    })
    .signers([allotmentKeypair])
    .rpc();
  
  console.log(`✅ Allotment created!`);
  console.log(`   Allotment: ${allotmentKeypair.publicKey.toBase58()}`);
  console.log(`   TX: ${signature.slice(0, 16)}...`);
  
  return {
    allotment: allotmentKeypair.publicKey,
    signature,
  };
}

/**
 * Modify an existing allotment
 */
export async function modifyAllotment(
  program: anchor.Program,
  mandate: PublicKey,
  allotment: PublicKey,
  owner: PublicKey,
  newAllowedAmount: number,
  newTtlHours: number
): Promise<string> {
  console.log("\n✏️  Modifying allotment...");
  
  const signature = await program.methods
    .modifyAllotment(
      new anchor.BN(newAllowedAmount),
      new anchor.BN(Math.floor(Date.now() / 1000) + newTtlHours * 3600)
    )
    .accounts({
      mandate,
      allotment,
      owner,
    })
    .rpc();
  
  console.log(`✅ Allotment modified!`);
  console.log(`   New allowed: ${newAllowedAmount / 1e6} tokens`);
  console.log(`   New TTL: ${newTtlHours} hours`);
  
  return signature;
}

/**
 * Revoke an allotment
 */
export async function revokeAllotment(
  program: anchor.Program,
  mandate: PublicKey,
  allotment: PublicKey,
  owner: PublicKey
): Promise<string> {
  console.log("\n🚫 Revoking allotment...");
  
  const signature = await program.methods
    .revokeAllotment()
    .accounts({
      mandate,
      allotment,
      owner,
    })
    .rpc();
  
  console.log(`✅ Allotment revoked!`);
  return signature;
}

/**
 * Revoke all allotments for an agent
 */
export async function revokeAgentAllotment(
  program: anchor.Program,
  mandate: PublicKey,
  allotment: PublicKey,
  owner: PublicKey
): Promise<string> {
  console.log("\n🚫 Revoking agent allotment...");
  
  const signature = await program.methods
    .revokeAgentAllotment()
    .accounts({
      mandate,
      allotment,
      owner,
    })
    .rpc();
  
  console.log(`✅ Agent allotment revoked!`);
  return signature;
}

/**
 * Fetch allotment account data
 */
export async function fetchAllotment(
  program: anchor.Program,
  allotment: PublicKey
): Promise<AllotmentAccount> {
  try {
    const account = await (program.account as any).allotmentAccount.fetch(allotment);
    return {
      mandate: account.mandate,
      agent: account.agent,
      allowedAmount: account.allowedAmount,
      spentAmount: account.spentAmount,
      ttl: account.ttl,
      revoked: account.revoked,
      redemptionCount: account.redemptionCount || new anchor.BN(0),
    };
  } catch (error: any) {
    if (error.message?.includes("AccountDidNotDeserialize") || error.code === 3003) {
      throw new Error(
        `Allotment account structure mismatch. This allotment was created with an older version of the protocol ` +
        `that doesn't include redemption_count. Please create a new allotment using the updated protocol. ` +
        `Allotment: ${allotment.toBase58()}`
      );
    }
    throw error;
  }
}

/**
 * Display allotment info
 */
export function displayAllotmentInfo(allotment: AllotmentAccount) {
  console.log("\n🎫 Allotment Info:");
  console.log(`   Mandate: ${allotment.mandate.toBase58()}`);
  console.log(`   Agent: ${allotment.agent.toBase58()}`);
  console.log(`   Allowed Amount: ${allotment.allowedAmount.toNumber() / 1e6} tokens`);
  console.log(`   Spent Amount: ${allotment.spentAmount.toNumber() / 1e6} tokens`);
  console.log(`   Remaining: ${(allotment.allowedAmount.toNumber() - allotment.spentAmount.toNumber()) / 1e6} tokens`);
  console.log(`   Redemption Count: ${allotment.redemptionCount.toNumber()}`);
  console.log(`   TTL: ${new Date(allotment.ttl.toNumber() * 1000).toISOString()}`);
  console.log(`   Revoked: ${allotment.revoked}`);
  console.log(`   Status: ${getAllotmentStatusDisplay(allotment)}`);
}

/**
 * Get allotment status
 */
export function getAllotmentStatus(allotment: AllotmentAccount): AllotmentStatus {
  if (allotment.revoked) return "revoked";
  if (Date.now() > allotment.ttl.toNumber() * 1000) return "expired";
  if (allotment.spentAmount.toNumber() >= allotment.allowedAmount.toNumber()) return "fully_spent";
  return "active";
}

/**
 * Get formatted status string with emoji (for display)
 */
export function getAllotmentStatusDisplay(allotment: AllotmentAccount): string {
  const status = getAllotmentStatus(allotment);
  switch (status) {
    case "revoked":
      return "❌ Revoked";
    case "expired":
      return "⏰ Expired";
    case "fully_spent":
      return "💯 Fully Spent";
    case "active":
      return "✅ Active";
  }
}

