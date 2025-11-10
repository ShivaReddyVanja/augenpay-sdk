import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { deriveTicketPDA } from "../core/pda";
import { OrderData, createContextHashArray, displayOrderHash } from "../utils/hashing";
import { RedeemEvent } from "../types/accounts";

export interface RedeemParams {
  allotment: PublicKey;
  mandate: PublicKey;
  agent: PublicKey;
  merchant: PublicKey;
  merchantTokenAccount: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  amount: number;
  orderData: OrderData;
}

/**
 * Agent redeems allotment to pay merchant
 * This is the core payment execution function
 */
export async function redeemAllotment(
  program: anchor.Program,
  params: RedeemParams
): Promise<{ ticket: PublicKey; signature: string; contextHash: number[] }> {
  console.log("\n💳 Executing payment (redeem)...");
  console.log(`   Amount: ${params.amount / 1e6} tokens`);
  console.log(`   Merchant: ${params.merchant.toBase58()}`);
  
  // Fetch allotment to get current redemption count
  const allotmentAccount = await (program.account as any).allotmentAccount.fetch(params.allotment);
  const redemptionCount = allotmentAccount.redemptionCount as anchor.BN;
  
  console.log(`   Current redemption count: ${redemptionCount.toString()}`);
  
  // Generate context hash from order data
  const contextHash = createContextHashArray(params.orderData);
  displayOrderHash(params.orderData, contextHash);
  
  // Derive ticket PDA with redemption count
  const [ticket, _ticketBump] = deriveTicketPDA(
    params.merchant,
    params.allotment,
    redemptionCount,
    program.programId
  );
  
  console.log(`\n   Ticket PDA: ${ticket.toBase58()}`);
  console.log(`   Executing transaction...`);
  
  const signature = await program.methods
    .redeem(new anchor.BN(params.amount), contextHash)
    .accounts({
      allotment: params.allotment,
      mandate: params.mandate,
      agent: params.agent,
      merchant: params.merchant,
      merchantTokenAccount: params.merchantTokenAccount,
      vault: params.vault,
      ticket,
      mint: params.mint,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  
  console.log(`\n✅ Payment executed successfully!`);
  console.log(`   TX: ${signature}`);
  console.log(`   Ticket: ${ticket.toBase58()}`);
  
  return { ticket, signature, contextHash };
}

/**
 * Listen for redeem events
 */
export function listenForRedeemEvents(
  program: anchor.Program,
  callback: (event: RedeemEvent) => void
): number {
  const listenerId = (program as any).addEventListener("RedeemEvent", (event: any, slot: number) => {
    // Convert Anchor event to typed RedeemEvent
    const typedEvent: RedeemEvent = {
      allotment: event.allotment,
      merchant: event.merchant,
      agent: event.agent,
      contextHash: event.contextHash,
      amount: event.amount,
      timestamp: event.timestamp,
    };
    console.log("\n🔔 Redeem Event Received:");
    console.log(`   Slot: ${slot}`);
    console.log(`   Allotment: ${event.allotment.toBase58()}`);
    console.log(`   Merchant: ${event.merchant.toBase58()}`);
    console.log(`   Agent: ${event.agent.toBase58()}`);
    console.log(`   Amount: ${event.amount.toNumber() / 1e6} tokens`);
    console.log(`   Timestamp: ${new Date(event.timestamp.toNumber() * 1000).toISOString()}`);
    
    callback(typedEvent);
  });
  
  return listenerId;
}

/**
 * Remove event listener
 */
export async function removeRedeemListener(
  program: anchor.Program,
  listenerId: number
): Promise<void> {
  await program.removeEventListener(listenerId);
}

