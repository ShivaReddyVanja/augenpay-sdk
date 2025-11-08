/**
 * Example 2: Basic Allotment Management
 * 
 * This example demonstrates:
 * - Creating an allotment for an agent
 * - Modifying an allotment
 * - Checking allotment status
 * - Revoking an allotment
 */

import { initializeClient, AUGENPAY_PROGRAM_ID, allotmentService, mandateService } from '../index';
import { Keypair, PublicKey } from '@solana/web3.js';

async function main() {
  // Setup
  const userKeypair = Keypair.generate();
  const agentKeypair = Keypair.generate();
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  const client = initializeClient(userKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  // Step 1: Create mandate (prerequisite)
  console.log('📝 Step 1: Creating mandate...');
  const { mandate } = await mandateService.createMandate(
    client.program,
    userKeypair.publicKey,
    mint,
    {
      perTxLimit: 100_000000,
      expiryDays: 30,
    }
  );
  
  // Step 2: Create allotment for agent
  console.log('\n🎫 Step 2: Creating allotment for agent...');
  const { allotment } = await allotmentService.createAllotment(
    client.program,
    mandate,
    agentKeypair.publicKey,
    userKeypair.publicKey,
    {
      allowedAmount: 200_000000, // 200 USDC
      ttlHours: 24, // 24 hours
    }
  );
  
  console.log(`✅ Allotment created: ${allotment.toBase58()}`);
  console.log(`   Agent: ${agentKeypair.publicKey.toBase58()}`);
  
  // Step 3: Fetch and display allotment
  console.log('\n📋 Step 3: Fetching allotment data...');
  const allotmentData = await allotmentService.fetchAllotment(
    client.program,
    allotment
  );
  allotmentService.displayAllotmentInfo(allotmentData);
  
  // Step 4: Check status
  const status = allotmentService.getAllotmentStatus(allotmentData);
  console.log(`\n📊 Status: ${status}`);
  
  // Step 5: Modify allotment
  console.log('\n✏️  Step 4: Modifying allotment...');
  await allotmentService.modifyAllotment(
    client.program,
    mandate,
    allotment,
    userKeypair.publicKey,
    300_000000, // New allowed amount: 300 USDC
    48 // New TTL: 48 hours
  );
  
  // Step 6: Fetch updated allotment
  const updatedAllotment = await allotmentService.fetchAllotment(
    client.program,
    allotment
  );
  allotmentService.displayAllotmentInfo(updatedAllotment);
  
  // Step 7: Revoke allotment
  console.log('\n🚫 Step 5: Revoking allotment...');
  await allotmentService.revokeAllotment(
    client.program,
    mandate,
    allotment,
    userKeypair.publicKey
  );
  
  const revokedAllotment = await allotmentService.fetchAllotment(
    client.program,
    allotment
  );
  console.log(`\n✅ Allotment revoked: ${revokedAllotment.revoked}`);
  
  console.log('\n✅ All operations completed!');
}

main().catch(console.error);

