/**
 * Example 0: Using the AugenPay Client Class
 * 
 * This example demonstrates the monolithic client class API,
 * which provides a simpler, object-oriented interface.
 * 
 * Compare this to the service-oriented API in other examples.
 */

import { AugenPayClient, AUGENPAY_PROGRAM_ID } from '../index';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

async function main() {
  // Setup
  const userKeypair = Keypair.generate();
  const agentKeypair = Keypair.generate();
  const merchantKeypair = Keypair.generate();
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  // ============================================
  // Initialize Client
  // ============================================
  console.log('🚀 Initializing AugenPay Client...');
  const client = new AugenPayClient(userKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  console.log(`✅ Client initialized`);
  console.log(`   Program ID: ${client.programId.toBase58()}`);
  console.log(`   Cluster: ${client.connection.rpcEndpoint}`);
  
  // ============================================
  // Mandate Operations
  // ============================================
  console.log('\n📝 Creating mandate...');
  const { mandate, vault } = await client.createMandate(
    userKeypair.publicKey,
    mint,
    {
      perTxLimit: 100_000000,
      expiryDays: 30,
    }
  );
  
  console.log(`✅ Mandate: ${mandate.toBase58()}`);
  
  // Deposit
  console.log('\n💰 Depositing funds...');
  const userTokenAccount = await getAssociatedTokenAddress(
    mint,
    userKeypair.publicKey
  );
  
  await client.deposit(
    mandate,
    userTokenAccount,
    vault,
    mint,
    userKeypair.publicKey,
    500_000000
  );
  
  // Fetch mandate
  const mandateData = await client.getMandate(mandate);
  client.displayMandate(mandateData);
  
  // ============================================
  // Allotment Operations
  // ============================================
  console.log('\n🎫 Creating allotment...');
  const { allotment } = await client.createAllotment(
    mandate,
    agentKeypair.publicKey,
    userKeypair.publicKey,
    {
      allowedAmount: 200_000000,
      ttlHours: 24,
    }
  );
  
  // Fetch allotment
  const allotmentData = await client.getAllotment(allotment);
  client.displayAllotment(allotmentData);
  
  const status = client.getAllotmentStatus(allotmentData);
  console.log(`\n📊 Status: ${status}`);
  
  // ============================================
  // Payment Operations
  // ============================================
  console.log('\n💳 Executing payment...');
  const merchantTokenAccount = await getAssociatedTokenAddress(
    mint,
    merchantKeypair.publicKey
  );
  
  const orderData = {
    orderId: 'ORD-12345',
    customerEmail: 'customer@example.com',
    items: [{ productId: 'PROD-1', quantity: 1, price: 50_000000 }],
    totalAmount: 50_000000,
    timestamp: Date.now(),
  };
  
  const { ticket, signature } = await client.redeem({
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantKeypair.publicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount: orderData.totalAmount,
    orderData,
  });
  
  console.log(`✅ Payment executed!`);
  console.log(`   Ticket: ${ticket.toBase58()}`);
  console.log(`   TX: ${signature}`);
  
  // ============================================
  // Merchant Operations
  // ============================================
  console.log('\n🏪 Merchant verifying payment...');
  const ticketData = await client.getTicket(ticket);
  client.displayTicket(ticketData);
  
  const { valid } = await client.verifyTicket(ticket, orderData);
  console.log(`\n✅ Verification: ${valid ? 'Valid' : 'Invalid'}`);
  
  // Get all merchant tickets
  const allTickets = await client.getMerchantTickets(merchantKeypair.publicKey);
  client.displayTickets(allTickets);
  
  console.log('\n✅ Client example completed!');
}

main().catch(console.error);

