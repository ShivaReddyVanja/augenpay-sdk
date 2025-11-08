/**
 * Example 1: Basic Mandate Management
 * 
 * This example demonstrates:
 * - Creating a mandate
 * - Depositing funds
 * - Withdrawing funds
 * - Pausing/resuming mandate
 * - Fetching mandate data
 */

import { initializeClient, AUGENPAY_PROGRAM_ID, mandateService } from '../index';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function main() {
  // Setup
  const userKeypair = Keypair.generate();
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  const client = initializeClient(userKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  // Step 1: Create Mandate
  console.log('📝 Step 1: Creating mandate...');
  const { mandate, vault, nonce } = await mandateService.createMandate(
    client.program,
    userKeypair.publicKey,
    mint,
    {
      perTxLimit: 100_000000, // 100 USDC (6 decimals)
      expiryDays: 30,
    }
  );
  
  console.log(`✅ Mandate created: ${mandate.toBase58()}`);
  console.log(`   Vault: ${vault.toBase58()}`);
  
  // Step 2: Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(
    mint,
    userKeypair.publicKey
  );
  
  // Step 3: Deposit funds (assuming user has tokens)
  console.log('\n💰 Step 2: Depositing funds...');
  await mandateService.depositToMandate(
    client.program,
    mandate,
    userTokenAccount,
    vault,
    mint,
    userKeypair.publicKey,
    500_000000 // 500 USDC
  );
  
  // Step 4: Fetch and display mandate info
  console.log('\n📋 Step 3: Fetching mandate data...');
  const mandateData = await mandateService.fetchMandate(client.program, mandate);
  mandateService.displayMandateInfo(mandateData);
  
  // Step 5: Pause mandate
  console.log('\n⏸️  Step 4: Pausing mandate...');
  await mandateService.pauseMandate(client.program, mandate, userKeypair.publicKey);
  
  // Step 6: Resume mandate
  console.log('\n▶️  Step 5: Resuming mandate...');
  await mandateService.resumeMandate(client.program, mandate, userKeypair.publicKey);
  
  // Step 7: Withdraw funds
  console.log('\n💸 Step 6: Withdrawing funds...');
  await mandateService.withdrawFromMandate(
    client.program,
    mandate,
    vault,
    userTokenAccount,
    mint,
    userKeypair.publicKey,
    100_000000 // 100 USDC
  );
  
  console.log('\n✅ All operations completed!');
}

main().catch(console.error);

