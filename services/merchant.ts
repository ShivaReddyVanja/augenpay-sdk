import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getMerchantTickets } from "../core/pda";
import { OrderData, verifyContextHash, hashToHex } from "../utils/hashing";

/**
 * Fetch a specific redemption ticket
 */
export async function fetchTicket(
  program: anchor.Program,
  ticket: PublicKey
): Promise<any> {
  return await (program.account as any).redemptionTicket.fetch(ticket);
}

/**
 * Fetch all tickets for a merchant
 */
export async function fetchMerchantTickets(
  program: anchor.Program,
  merchant: PublicKey
): Promise<Array<{ pubkey: PublicKey; account: any }>> {
  const ticketPubkeys = await getMerchantTickets(
    merchant,
    program.programId,
    program.provider.connection
  );
  
  console.log(`\n🔍 Found ${ticketPubkeys.length} ticket(s) for merchant`);
  
  const tickets = await Promise.all(
    ticketPubkeys.map(async (pubkey) => {
      const account = await fetchTicket(program, pubkey);
      return { pubkey, account };
    })
  );
  
  return tickets;
}

/**
 * Verify a redemption ticket matches order data
 */
export async function verifyTicket(
  program: anchor.Program,
  ticket: PublicKey,
  expectedOrderData: OrderData
): Promise<{ valid: boolean; ticketData: any }> {
  console.log("\n✅ Verifying ticket...");
  console.log(`   Ticket: ${ticket.toBase58()}`);
  
  const ticketData = await fetchTicket(program, ticket);
  
  // Verify context hash matches
  const isValid = verifyContextHash(
    expectedOrderData,
    ticketData.contextHash
  );
  
  if (isValid) {
    console.log("   ✅ Context hash verified!");
    console.log(`   Amount: ${ticketData.amount.toNumber() / 1e6} tokens`);
    console.log(`   Timestamp: ${new Date(ticketData.timestamp.toNumber() * 1000).toISOString()}`);
  } else {
    console.log("   ❌ Context hash mismatch!");
  }
  
  return { valid: isValid, ticketData };
}

/**
 * Display ticket information
 */
export function displayTicketInfo(ticket: any) {
  console.log("\n🎫 Redemption Ticket:");
  console.log(`   Allotment: ${ticket.allotment.toBase58()}`);
  console.log(`   Merchant: ${ticket.merchant.toBase58()}`);
  console.log(`   Context Hash: ${hashToHex(ticket.contextHash)}`);
  console.log(`   Amount: ${ticket.amount.toNumber() / 1e6} tokens`);
  console.log(`   Timestamp: ${new Date(ticket.timestamp.toNumber() * 1000).toISOString()}`);
}

/**
 * Display all merchant tickets
 */
export function displayMerchantTickets(
  tickets: Array<{ pubkey: PublicKey; account: any }>
) {
  console.log(`\n📋 Merchant Tickets (${tickets.length} total):`);
  console.log("=".repeat(80));
  
  tickets.forEach((ticket, index) => {
    console.log(`\n🎫 Ticket #${index + 1}:`);
    console.log(`   PDA: ${ticket.pubkey.toBase58()}`);
    console.log(`   Allotment: ${ticket.account.allotment.toBase58()}`);
    console.log(`   Amount: ${ticket.account.amount.toNumber() / 1e6} tokens`);
    console.log(`   Hash: ${hashToHex(ticket.account.contextHash).slice(0, 32)}...`);
    console.log(`   Time: ${new Date(ticket.account.timestamp.toNumber() * 1000).toISOString()}`);
  });
  
  console.log("\n" + "=".repeat(80));
}

/**
 * Monitor for new tickets (polling)
 */
export async function monitorMerchantTickets(
  program: anchor.Program,
  merchant: PublicKey,
  intervalSeconds: number = 5,
  callback: (newTickets: Array<{ pubkey: PublicKey; account: any }>) => void
): Promise<NodeJS.Timeout> {
  let lastTicketCount = 0;
  
  const interval = setInterval(async () => {
    try {
      const tickets = await fetchMerchantTickets(program, merchant);
      
      if (tickets.length > lastTicketCount) {
        const newTickets = tickets.slice(lastTicketCount);
        console.log(`\n🔔 ${newTickets.length} new ticket(s) detected!`);
        callback(newTickets);
      }
      
      lastTicketCount = tickets.length;
    } catch (error: any) {
      console.error(`Error monitoring tickets: ${error.message}`);
    }
  }, intervalSeconds * 1000);
  
  console.log(`\n👀 Monitoring merchant tickets (every ${intervalSeconds}s)...`);
  return interval;
}

/**
 * Stop monitoring tickets
 */
export function stopMonitoring(interval: NodeJS.Timeout) {
  clearInterval(interval);
  console.log("\n⏹️  Stopped monitoring tickets");
}

/**
 * Search for a ticket by context hash
 */
export async function findTicketByHash(
  program: anchor.Program,
  merchant: PublicKey,
  targetHash: number[] | Buffer | Uint8Array
): Promise<{ pubkey: PublicKey; account: any } | null> {
  const tickets = await fetchMerchantTickets(program, merchant);
  const hashBuffer = Buffer.isBuffer(targetHash)
    ? targetHash
    : Buffer.from(targetHash);
  
  for (const ticket of tickets) {
    const ticketHash = Buffer.from(ticket.account.contextHash);
    if (ticketHash.equals(hashBuffer)) {
      return ticket;
    }
  }
  
  return null;
}

/**
 * Verify and fulfill order
 */
export async function verifyAndFulfillOrder(
  program: anchor.Program,
  ticket: PublicKey,
  expectedOrderData: OrderData,
  fulfillmentCallback: (ticketData: any) => Promise<void>
): Promise<boolean> {
  const { valid, ticketData } = await verifyTicket(
    program,
    ticket,
    expectedOrderData
  );
  
  if (valid) {
    console.log("\n✅ Payment verified! Fulfilling order...");
    await fulfillmentCallback(ticketData);
    console.log("✅ Order fulfilled!");
    return true;
  } else {
    console.log("\n❌ Payment verification failed! Order NOT fulfilled.");
    return false;
  }
}

