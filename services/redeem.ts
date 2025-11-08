import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { deriveTicketPDA } from "../core/pda";
import { OrderData, createContextHashArray, displayOrderHash } from "../utils/hashing";

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
  
  // Generate context hash from order data
  const contextHash = createContextHashArray(params.orderData);
  displayOrderHash(params.orderData, contextHash);
  
  // Derive ticket PDA
  const [ticket, _ticketBump] = deriveTicketPDA(
    params.merchant,
    params.allotment,
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
 * Simplified payment flow for movie tickets
 */
export async function payForMovieTickets(
  program: anchor.Program,
  params: {
    allotment: PublicKey;
    mandate: PublicKey;
    agent: PublicKey;
    merchant: PublicKey;
    merchantTokenAccount: PublicKey;
    vault: PublicKey;
    mint: PublicKey;
    movieName: string;
    numberOfTickets: number;
    email: string;
    showtime?: string;
    pricePerTicket: number; // in token base units
  }
): Promise<{ ticket: PublicKey; signature: string }> {
  console.log("\n🎬 Buying movie tickets...");
  console.log(`   Movie: ${params.movieName}`);
  console.log(`   Tickets: ${params.numberOfTickets}`);
  console.log(`   Email: ${params.email}`);
  
  const orderData: OrderData = {
    email: params.email,
    movie: params.movieName,
    numberOfTickets: params.numberOfTickets,
    showtime: params.showtime || "TBD",
    pricePerTicket: params.pricePerTicket,
    timestamp: Date.now(),
  };
  
  const totalAmount = params.numberOfTickets * params.pricePerTicket;
  
  const result = await redeemAllotment(program, {
    allotment: params.allotment,
    mandate: params.mandate,
    agent: params.agent,
    merchant: params.merchant,
    merchantTokenAccount: params.merchantTokenAccount,
    vault: params.vault,
    mint: params.mint,
    amount: totalAmount,
    orderData,
  });
  
  return result;
}

/**
 * Simplified payment flow for e-commerce
 */
export async function payForEcommerceOrder(
  program: anchor.Program,
  params: {
    allotment: PublicKey;
    mandate: PublicKey;
    agent: PublicKey;
    merchant: PublicKey;
    merchantTokenAccount: PublicKey;
    vault: PublicKey;
    mint: PublicKey;
    orderId: string;
    customerEmail: string;
    items: { productId: string; quantity: number; price: number }[];
    shippingAddress?: string;
  }
): Promise<{ ticket: PublicKey; signature: string }> {
  console.log("\n🛒 Processing e-commerce order...");
  console.log(`   Order ID: ${params.orderId}`);
  console.log(`   Items: ${params.items.length}`);
  
  const totalAmount = params.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  
  const orderData: OrderData = {
    orderId: params.orderId,
    customerEmail: params.customerEmail,
    items: params.items,
    totalAmount,
    shippingAddress: params.shippingAddress,
    timestamp: Date.now(),
  };
  
  const result = await redeemAllotment(program, {
    allotment: params.allotment,
    mandate: params.mandate,
    agent: params.agent,
    merchant: params.merchant,
    merchantTokenAccount: params.merchantTokenAccount,
    vault: params.vault,
    mint: params.mint,
    amount: totalAmount,
    orderData,
  });
  
  return result;
}

/**
 * Listen for redeem events
 */
export function listenForRedeemEvents(
  program: anchor.Program,
  callback: (event: any) => void
): number {
  const listenerId = (program as any).addEventListener("RedeemEvent", (event: any, slot: number) => {
    console.log("\n🔔 Redeem Event Received:");
    console.log(`   Slot: ${slot}`);
    console.log(`   Allotment: ${event.allotment.toBase58()}`);
    console.log(`   Merchant: ${event.merchant.toBase58()}`);
    console.log(`   Agent: ${event.agent.toBase58()}`);
    console.log(`   Amount: ${event.amount.toNumber() / 1e6} tokens`);
    console.log(`   Timestamp: ${new Date(event.timestamp.toNumber() * 1000).toISOString()}`);
    
    callback(event);
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

