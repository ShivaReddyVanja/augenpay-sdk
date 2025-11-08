/**
 * Example 3: Basic Payment Flow
 * 
 * This example demonstrates the complete payment flow:
 * - User creates mandate and deposits funds
 * - User creates allotment for agent
 * - Agent executes payment to merchant
 * - Merchant verifies payment
 */

import {
  initializeClient,
  AUGENPAY_PROGRAM_ID,
  mandateService,
  allotmentService,
  redeemService,
  merchantService,
} from '../index';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

async function main() {
  // Setup participants
  const userKeypair = Keypair.generate();
  const agentKeypair = Keypair.generate();
  const merchantKeypair = Keypair.generate();
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  const client = initializeClient(userKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  // ============================================
  // PHASE 1: User Setup
  // ============================================
  console.log('👤 PHASE 1: User Setup');
  console.log('='.repeat(50));
  
  // 1.1: Create mandate
  console.log('\n📝 Creating mandate...');
  const { mandate, vault } = await mandateService.createMandate(
    client.program,
    userKeypair.publicKey,
    mint,
    {
      perTxLimit: 100_000000, // 100 USDC per transaction
      expiryDays: 30,
    }
  );
  
  // 1.2: Deposit funds
  console.log('\n💰 Depositing funds...');
  const userTokenAccount = await getAssociatedTokenAddress(
    mint,
    userKeypair.publicKey
  );
  
  await mandateService.depositToMandate(
    client.program,
    mandate,
    userTokenAccount,
    vault,
    mint,
    userKeypair.publicKey,
    1000_000000 // 1000 USDC
  );
  
  // 1.3: Create allotment for agent
  console.log('\n🎫 Creating allotment for agent...');
  const { allotment } = await allotmentService.createAllotment(
    client.program,
    mandate,
    agentKeypair.publicKey,
    userKeypair.publicKey,
    {
      allowedAmount: 500_000000, // 500 USDC
      ttlHours: 24,
    }
  );
  
  // ============================================
  // PHASE 2: Agent Payment
  // ============================================
  console.log('\n\n🤖 PHASE 2: Agent Payment');
  console.log('='.repeat(50));
  
  // 2.1: Prepare order data
  const orderData = {
    orderId: 'ORD-12345',
    customerEmail: 'customer@example.com',
    items: [
      { productId: 'PROD-1', quantity: 2, price: 25_000000 },
      { productId: 'PROD-2', quantity: 1, price: 50_000000 },
    ],
    totalAmount: 100_000000, // 100 USDC
    timestamp: Date.now(),
  };
  
  // 2.2: Get merchant token account
  const merchantTokenAccount = await getAssociatedTokenAddress(
    mint,
    merchantKeypair.publicKey
  );
  
  // 2.3: Execute payment
  console.log('\n💳 Executing payment...');
  const { ticket, signature } = await redeemService.redeemAllotment(
    client.program,
    {
      allotment,
      mandate,
      agent: agentKeypair.publicKey,
      merchant: merchantKeypair.publicKey,
      merchantTokenAccount,
      vault,
      mint,
      amount: orderData.totalAmount,
      orderData,
    }
  );
  
  console.log(`✅ Payment executed!`);
  console.log(`   Ticket: ${ticket.toBase58()}`);
  console.log(`   TX: ${signature}`);
  
  // ============================================
  // PHASE 3: Merchant Verification
  // ============================================
  console.log('\n\n🏪 PHASE 3: Merchant Verification');
  console.log('='.repeat(50));
  
  // 3.1: Fetch ticket
  console.log('\n🔍 Fetching ticket...');
  const ticketData = await merchantService.fetchTicket(client.program, ticket);
  merchantService.displayTicketInfo(ticketData);
  
  // 3.2: Verify ticket
  console.log('\n✅ Verifying ticket...');
  const { valid, ticketData: verifiedTicket } = await merchantService.verifyTicket(
    client.program,
    ticket,
    orderData
  );
  
  if (valid) {
    console.log('✅ Payment verified! Order can be fulfilled.');
    // Fulfill order (ship product, send email, etc.)
  } else {
    console.log('❌ Payment verification failed!');
  }
  
  // 3.3: Query all merchant tickets
  console.log('\n📋 Querying all merchant tickets...');
  const allTickets = await merchantService.fetchMerchantTickets(
    client.program,
    merchantKeypair.publicKey
  );
  merchantService.displayMerchantTickets(allTickets);
  
  console.log('\n✅ Complete payment flow executed successfully!');
}

main().catch(console.error);

