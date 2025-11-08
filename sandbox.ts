#!/usr/bin/env ts-node

/**
 * AugenPay SDK Sandbox
 * 
 * Complete demonstration of the payment flow:
 * 1. User creates mandate
 * 2. User deposits funds
 * 3. User creates allotment for agent
 * 4. Agent buys movie tickets from merchant
 * 5. Merchant verifies payment on-chain
 */

import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { AUGENPAY_PROGRAM_ID } from "./config/constants";
import { AugenPayClient } from "./core/client";
import { getBalance } from "./core/wallet";
import { setupTestEnvironment, getTokenBalance, formatTokenAmount } from "./utils/tokens";
import { createContextHashArray, hashToHex, OrderData } from "./utils/hashing";

/**
 * Load fixed keypair from file
 */
function loadKeypair(filename: string): Keypair {
  const keypairPath = path.join(__dirname, ".keypairs", filename);
  
  if (!fs.existsSync(keypairPath)) {
    console.error(`\n❌ Keypair not found: ${filename}`);
    console.error("\n🔑 Please generate keypairs first:");
    console.error("   yarn generate-keypairs");
    console.error("\n💰 Then fund them at: https://faucet.solana.com");
    process.exit(1);
  }
  
  const secretKeyString = fs.readFileSync(keypairPath, "utf8");
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

async function main() {
  console.log("🚀 AugenPay SDK Sandbox");
  console.log("=".repeat(80));
  
  // ============================================
  // STEP 0: Setup
  // ============================================
  console.log("\n📦 STEP 0: Setting up test environment");
  console.log("=".repeat(80));
  
  // Load fixed keypairs
  console.log("\n🔑 Loading fixed keypairs...");
  const user = loadKeypair("user.json");
  const agent = loadKeypair("agent.json");
  const merchant = loadKeypair("merchant.json");
  
  console.log("\n👥 Test Participants:");
  console.log(`   User: ${user.publicKey.toBase58()}`);
  console.log(`   Agent: ${agent.publicKey.toBase58()}`);
  console.log(`   Merchant: ${merchant.publicKey.toBase58()}`);
  
  // Initialize client (user's client)
  const client = new AugenPayClient(user, "devnet", AUGENPAY_PROGRAM_ID);
  
  console.log(`\n📡 Connected to: ${client.connection.rpcEndpoint}`);
  console.log(`   Program ID: ${client.programId.toBase58()}`);
  
  // Check SOL balances
  console.log("\n💰 Checking SOL Balances:");
  const userBalance = await getBalance(client.connection, user.publicKey);
  const agentBalance = await getBalance(client.connection, agent.publicKey);
  const merchantBalance = await getBalance(client.connection, merchant.publicKey);
  
  console.log(`   User: ${userBalance} SOL`);
  console.log(`   Agent: ${agentBalance} SOL`);
  console.log(`   Merchant: ${merchantBalance} SOL`);
  
  // Verify sufficient balances
  if (userBalance < 0.5 || agentBalance < 0.5 || merchantBalance < 0.2) {
    console.error("\n❌ Insufficient SOL balance!");
    console.error("\n💰 Please fund wallets at: https://faucet.solana.com");
    console.error(`   User:     https://faucet.solana.com/?address=${user.publicKey.toBase58()}`);
    console.error(`   Agent:    https://faucet.solana.com/?address=${agent.publicKey.toBase58()}`);
    console.error(`   Merchant: https://faucet.solana.com/?address=${merchant.publicKey.toBase58()}`);
    process.exit(1);
  }
  
  console.log("✅ All wallets have sufficient SOL");
  
  // Setup test token
  const { mint, tokenAccounts } = await setupTestEnvironment(
    client.connection,
    user,
    [user, agent, merchant],
    1000_000000 // 1000 tokens each
  );
  
  const [userTokenAccount, agentTokenAccount, merchantTokenAccount] = tokenAccounts;
  
  console.log("\n🪙 Token Balances:");
  console.log(`   User: ${formatTokenAmount(await getTokenBalance(client.connection, userTokenAccount))} tokens`);
  console.log(`   Agent: ${formatTokenAmount(await getTokenBalance(client.connection, agentTokenAccount))} tokens`);
  console.log(`   Merchant: ${formatTokenAmount(await getTokenBalance(client.connection, merchantTokenAccount))} tokens`);
  
  // ============================================
  // STEP 1: User creates mandate
  // ============================================
  console.log("\n\n📝 STEP 1: User creates mandate");
  console.log("=".repeat(80));
  
  const { mandate, vault, nonce } = await client.createMandate(
    user.publicKey,
    mint,
    {
      perTxLimit: 100_000000, // 100 tokens per transaction
      expiryDays: 30, // 30 days
    }
  );
  
  // Fetch and display mandate info
  const mandateData = await client.getMandate(mandate);
  client.displayMandate(mandateData);
  
  // ============================================
  // STEP 2: User deposits 500 tokens
  // ============================================
  console.log("\n\n💰 STEP 2: User deposits funds into mandate");
  console.log("=".repeat(80));
  
  await client.deposit(
    mandate,
    userTokenAccount,
    vault,
    mint,
    user.publicKey,
    500_000000 // 500 tokens
  );
  
  console.log(`\n📊 Updated balances:`);
  console.log(`   User token account: ${formatTokenAmount(await getTokenBalance(client.connection, userTokenAccount))} tokens`);
  console.log(`   Vault: ${formatTokenAmount(await getTokenBalance(client.connection, vault))} tokens`);
  
  // ============================================
  // STEP 3: User creates allotment for agent
  // ============================================
  console.log("\n\n🎫 STEP 3: User creates spending allotment for agent");
  console.log("=".repeat(80));
  
  const { allotment } = await client.createAllotment(
    mandate,
    agent.publicKey,
    user.publicKey,
    {
      allowedAmount: 200_000000, // 200 tokens
      ttlHours: 24, // 24 hours
    }
  );
  
  // Fetch and display allotment info
  const allotmentData = await client.getAllotment(allotment);
  client.displayAllotment(allotmentData);
  
  // ============================================
  // STEP 4: Complete Payment Flow (Movie Tickets)
  // ============================================
  console.log("\n\n🎬 STEP 4: Agent buys movie tickets for user");
  console.log("=".repeat(80));
  
  console.log("\n📱 User Request:");
  console.log("   'Buy 2 tickets for Batman: The Dark Knight at 7:00 PM'");
  
  console.log("\n🤖 Agent → Merchant Website:");
  const orderRequest = {
    email: "user@example.com",
    movieName: "Batman: The Dark Knight",
    numberOfTickets: 2,
    showtime: "7:00 PM",
  };
  console.log(JSON.stringify(orderRequest, null, 2));
  
  console.log("\n🏪 Merchant generates order hash and responds:");
  // Create order data (merchant-defined structure)
  const orderData: OrderData = {
    email: orderRequest.email,
    movie: orderRequest.movieName,
    numberOfTickets: orderRequest.numberOfTickets,
    showtime: orderRequest.showtime,
    timestamp: Date.now(),
  };
  const hash = createContextHashArray(orderData);
  const hashHex = hashToHex(hash);
  
  console.log(`   Payment address: ${merchantTokenAccount.toBase58()}`);
  console.log(`   Order hash: ${hashHex}`);
  console.log(`   Amount: 20 tokens (10 per ticket)`);
  
  const merchantBalanceBefore = await getTokenBalance(client.connection, merchantTokenAccount);
  
  console.log("\n⛓️  Agent executes payment on blockchain:");
  
  // Create agent's client for signing transactions
  const agentClient = new AugenPayClient(agent, "devnet", AUGENPAY_PROGRAM_ID);
  
  const totalAmount = orderRequest.numberOfTickets * 10_000000; // 10 tokens per ticket
  
  const { ticket, signature } = await agentClient.redeem({
    allotment,
    mandate,
    agent: agent.publicKey,
    merchant: merchant.publicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount: totalAmount,
    orderData,
  });
  
  // Verify transfer
  const merchantBalanceAfter = await getTokenBalance(client.connection, merchantTokenAccount);
  const amountReceived = Number(merchantBalanceAfter) - Number(merchantBalanceBefore);
  
  console.log(`\n💸 Payment Confirmation:`);
  console.log(`   Merchant received: ${formatTokenAmount(amountReceived)} tokens`);
  console.log(`   Transaction: ${signature}`);
  console.log(`   Ticket PDA: ${ticket.toBase58()}`);
  
  console.log(`\n📊 Updated balances:`);
  console.log(`   Vault: ${formatTokenAmount(await getTokenBalance(client.connection, vault))} tokens`);
  console.log(`   Merchant: ${formatTokenAmount(merchantBalanceAfter)} tokens`);
  
  // Update allotment display
  const updatedAllotment = await client.getAllotment(allotment);
  console.log(`   Allotment spent: ${formatTokenAmount(updatedAllotment.spentAmount.toNumber())} tokens`);
  console.log(`   Allotment remaining: ${formatTokenAmount(updatedAllotment.allowedAmount.toNumber() - updatedAllotment.spentAmount.toNumber())} tokens`);
  
  // ============================================
  // STEP 5: Merchant verifies payment
  // ============================================
  console.log("\n\n✅ STEP 5: Merchant verifies payment on-chain");
  console.log("=".repeat(80));
  
  // Merchant fetches ticket
  const ticketData = await client.getTicket(ticket);
  client.displayTicket(ticketData);
  
  // Verify hash matches
  const { valid } = await client.verifyTicket(ticket, orderData);
  
  if (valid) {
    console.log("\n📧 Merchant fulfills order:");
    console.log("   ✅ Sending 2 tickets for 'Batman: The Dark Knight'");
    console.log("   ✅ To: user@example.com");
    console.log("   ✅ Showtime: 7:00 PM");
    console.log("   ✅ Order complete!");
  }
  
  // ============================================
  // STEP 6: Merchant views all tickets
  // ============================================
  console.log("\n\n📋 STEP 6: Merchant queries all their tickets");
  console.log("=".repeat(80));
  
  const allTickets = await client.getMerchantTickets(merchant.publicKey);
  client.displayTickets(allTickets);
  
  // ============================================
  // STEP 7: Additional features demo
  // ============================================
  console.log("\n\n🎯 STEP 7: Additional Features");
  console.log("=".repeat(80));
  
  console.log("\n✏️  Testing allotment modification:");
  await client.modifyAllotment(
    mandate,
    allotment,
    user.publicKey,
    300_000000, // Increase to 300 tokens
    48 // Extend to 48 hours
  );
  
  const modifiedAllotment = await client.getAllotment(allotment);
  client.displayAllotment(modifiedAllotment);
  
  console.log("\n⏸️  Testing pause/resume:");
  await client.pauseMandate(mandate, user.publicKey);
  console.log("   ✅ Mandate paused");
  
  await client.resumeMandate(mandate, user.publicKey);
  console.log("   ✅ Mandate resumed");
  
  console.log("\n💸 Testing withdrawal:");
  await client.withdraw(
    mandate,
    vault,
    userTokenAccount,
    mint,
    user.publicKey,
    100_000000 // Withdraw 100 tokens
  );
  
  console.log(`\n📊 Final balances:`);
  console.log(`   User: ${formatTokenAmount(await getTokenBalance(client.connection, userTokenAccount))} tokens`);
  console.log(`   Vault: ${formatTokenAmount(await getTokenBalance(client.connection, vault))} tokens`);
  console.log(`   Merchant: ${formatTokenAmount(await getTokenBalance(client.connection, merchantTokenAccount))} tokens`);
  
  // ============================================
  // Summary
  // ============================================
  console.log("\n\n🎉 SANDBOX COMPLETE!");
  console.log("=".repeat(80));
  console.log("\n✅ Successfully demonstrated:");
  console.log("   - Mandate creation and management");
  console.log("   - Token deposits and withdrawals");
  console.log("   - Agent allotment creation and modification");
  console.log("   - Complete payment flow with hash verification");
  console.log("   - Merchant payment verification");
  console.log("   - Ticket discoverability");
  console.log("   - Pause/resume functionality");
  
  console.log("\n📚 Explore the SDK:");
  console.log("   - AugenPayClient: Monolithic client class (used in this sandbox)");
  console.log("   - Services: Service-oriented API for advanced use cases");
  console.log("   - config/: Configuration and constants");
  console.log("   - core/: Connection, PDA, wallet, and client utilities");
  console.log("   - utils/: Token and hashing utilities");
  
  console.log("\n🚀 Ready for integration!");
  console.log("=".repeat(80));
}

// Run the sandbox
main()
  .then(() => {
    console.log("\n✨ Sandbox execution completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

