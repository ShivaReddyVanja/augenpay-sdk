/**
 * Agent Commands
 * Commands for the Agent role: list allotments, execute payments
 */

import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Environment, formatTransaction } from "../utils/environment";
import { getSession, saveSession, loadSession } from "../utils/session";
import { getOrCreateATA, formatTokenAmount } from "../../utils/tokens";
import { DEVNET_USDC_MINT, AUGENPAY_PROGRAM_ID } from "../../config/constants";
import { getAgentAllotments } from "../../core/pda";
import chalk from "chalk";
import inquirer from "inquirer";

export function createAgentCommands(program: Command, env: Environment): void {
  const agentCmd = program
    .command("agent")
    .description("Agent role commands - execute payments using allotments");

  // List allotments
  agentCmd
    .command("list-allotments")
    .description("List available allotments for this agent")
    .action(async () => {
      try {
        console.log(chalk.cyan("\n🔍 Fetching your allotments..."));
        console.log(chalk.gray(`   Agent: ${env.wallets.agent.publicKey.toBase58()}`));
        
        const allotments = await getAgentAllotments(
          env.wallets.agent.publicKey,
          AUGENPAY_PROGRAM_ID,
          env.connection
        );

        if (allotments.length === 0) {
          console.log(chalk.yellow("\n📭 No allotments found"));
          console.log(chalk.gray("   Ask a user to create an allotment for you"));
          return;
        }

        // Filter valid and invalid allotments
        const validAllotments: { pubkey: PublicKey; data: any }[] = [];
        const invalidAllotments: PublicKey[] = [];

        for (const allotment of allotments) {
          try {
            const data = await env.clients.agent.getAllotment(allotment);
            validAllotments.push({ pubkey: allotment, data });
          } catch (error: any) {
            if (error.message?.includes("AccountDidNotDeserialize") || error.message?.includes("structure mismatch")) {
              invalidAllotments.push(allotment);
            } else {
              // Other errors - show them
              console.log(chalk.red(`   ${allotment.toBase58()} (Error: ${error.message})`));
            }
          }
        }

        if (invalidAllotments.length > 0) {
          console.log(chalk.yellow(`\n⚠️  Found ${invalidAllotments.length} incompatible allotment(s) (created with old protocol):`));
          invalidAllotments.forEach((allotment) => {
            console.log(chalk.red(`   ❌ ${allotment.toBase58()}`));
          });
          console.log(chalk.gray("   These cannot be used. Ask user to create new allotments.\n"));
        }

        if (validAllotments.length === 0) {
          console.log(chalk.yellow("\n📭 No valid allotments found"));
          if (invalidAllotments.length > 0) {
            console.log(chalk.gray("   All your allotments are incompatible with the current protocol."));
            console.log(chalk.gray("   Ask a user to create a new allotment for you"));
          } else {
            console.log(chalk.gray("   Ask a user to create an allotment for you"));
          }
          return;
        }

        console.log(chalk.green(`\n✅ Found ${validAllotments.length} valid allotment(s):\n`));
        for (let i = 0; i < validAllotments.length; i++) {
          const { pubkey, data: allotmentData } = validAllotments[i];
          const isLast = pubkey.toBase58() === getSession("lastAllotment");
          
          const remaining = allotmentData.allowedAmount.toNumber() - allotmentData.spentAmount.toNumber();
          const isExpired = allotmentData.ttl.toNumber() < Math.floor(Date.now() / 1000);
          const status = allotmentData.revoked 
            ? chalk.red("REVOKED")
            : isExpired
            ? chalk.yellow("EXPIRED")
            : chalk.green("ACTIVE");
          
          console.log(chalk.cyan(`${i + 1}. ${isLast ? "⭐ " : ""}${chalk.bold(pubkey.toBase58())} ${chalk.gray("← Use this address for redeem!")}`));
          console.log(chalk.white(`   Status: ${status}`));
          console.log(chalk.gray(`   Mandate: ${allotmentData.mandate.toBase58()} ${chalk.yellow("(don't use this)")}`));
          console.log(chalk.white(`   Allowed: ${formatTokenAmount(allotmentData.allowedAmount.toNumber())} tokens`));
          console.log(chalk.white(`   Spent: ${formatTokenAmount(allotmentData.spentAmount.toNumber())} tokens`));
          console.log(chalk.white(`   Remaining: ${formatTokenAmount(remaining)} tokens`));
          console.log(chalk.white(`   Redemptions: ${allotmentData.redemptionCount.toString()}`));
          console.log(chalk.gray(`   Expiry: ${new Date(allotmentData.ttl.toNumber() * 1000).toLocaleString()}`));
          console.log();
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // Redeem (execute payment)
  agentCmd
    .command("redeem")
    .description("Execute payment using an allotment")
    .allowExcessArguments(true) // Allow extra arguments (positional allotment)
    .option("-a, --allotment <address>", "Allotment address (uses last if not provided)")
    .option("-m, --merchant <address>", "Merchant address (uses merchant wallet if not provided)")
    .option("-t, --amount <number>", "Payment amount (in tokens)", parseFloat)
    .option("-o, --order-id <id>", "Order ID")
    .action(async (options, command) => {
      try {
        // Allow allotment as option (positional args are converted to --allotment in CLI)
        let allotmentAddr = options.allotment;
        const sessionAllotment = getSession("lastAllotment");
        
        // If no allotment specified, check session allotment first, but validate it
        if (!allotmentAddr && sessionAllotment) {
          try {
            // Try to fetch the session allotment to see if it's valid
            const testAllotment = new PublicKey(sessionAllotment);
            await env.clients.agent.getAllotment(testAllotment);
            // If it works, use it
            allotmentAddr = sessionAllotment;
          } catch (error: any) {
            // Session allotment is invalid (old structure), clear it and show selection
            if (error.message?.includes("AccountDidNotDeserialize") || error.message?.includes("structure mismatch")) {
              console.log(chalk.yellow("\n⚠️  Last used allotment is incompatible (created with old protocol)"));
              console.log(chalk.gray("   Clearing from session and showing available allotments...\n"));
              // Clear invalid allotment from session
              const session = loadSession();
              delete session.lastAllotment;
              saveSession(session);
            }
          }
        }
        
        // If still no allotment, let agent choose from their allotments
        if (!allotmentAddr) {
          console.log(chalk.cyan("\n🔍 Fetching your allotments..."));
          const allotments = await getAgentAllotments(
            env.wallets.agent.publicKey,
            AUGENPAY_PROGRAM_ID,
            env.connection
          );

          if (allotments.length === 0) {
            console.error(chalk.red("❌ No allotments found. Ask a user to create an allotment for you first"));
            return;
          }

          // Filter out incompatible allotments and fetch valid ones
          const validAllotments: { pubkey: PublicKey; data: any }[] = [];
          const invalidAllotments: PublicKey[] = [];

          for (const allotment of allotments) {
            try {
              const data = await env.clients.agent.getAllotment(allotment);
              validAllotments.push({ pubkey: allotment, data });
            } catch (error: any) {
              if (error.message?.includes("AccountDidNotDeserialize") || error.message?.includes("structure mismatch")) {
                invalidAllotments.push(allotment);
              } else {
                throw error;
              }
            }
          }

          if (invalidAllotments.length > 0) {
            console.log(chalk.yellow(`\n⚠️  Found ${invalidAllotments.length} incompatible allotment(s) (created with old protocol)`));
            console.log(chalk.gray("   These will be skipped. Ask user to create new allotments.\n"));
          }

          if (validAllotments.length === 0) {
            console.error(chalk.red("❌ No valid allotments found. All allotments are incompatible with the current protocol."));
            console.log(chalk.yellow("💡 Ask a user to create a new allotment for you"));
            return;
          }

          if (validAllotments.length === 1) {
            allotmentAddr = validAllotments[0].pubkey.toBase58();
            console.log(chalk.gray(`   Using your only valid allotment: ${allotmentAddr}`));
          } else {
            // Create choices from valid allotments
            const allotmentChoices = validAllotments.map(({ pubkey, data }) => {
              const remaining = data.allowedAmount.toNumber() - data.spentAmount.toNumber();
              const isExpired = data.ttl.toNumber() < Math.floor(Date.now() / 1000);
              const status = data.revoked ? "REVOKED" : isExpired ? "EXPIRED" : "ACTIVE";
              const isLast = pubkey.toBase58() === sessionAllotment;
              
              return {
                name: `${pubkey.toBase58()} ${isLast ? "(last used)" : ""} - ${status} - ${formatTokenAmount(remaining)} remaining`,
                value: pubkey.toBase58(),
              };
            });

            const answer = await inquirer.prompt([
              {
                type: "list",
                name: "allotment",
                message: "Select allotment to use:",
                choices: allotmentChoices,
              },
            ]);
            allotmentAddr = answer.allotment;
          }
        }

        // Validate allotment address format
        let allotment: PublicKey;
        try {
          allotment = new PublicKey(allotmentAddr);
        } catch (error: any) {
          console.error(chalk.red(`\n❌ Invalid allotment address: ${allotmentAddr}`));
          console.log(chalk.yellow("💡 Make sure the address is a valid Solana public key"));
          return;
        }

        // Fetch allotment data with better error handling
        let allotmentData;
        try {
          allotmentData = await env.clients.agent.getAllotment(allotment);
        } catch (error: any) {
          if (error.message?.includes("AccountDidNotDeserialize") || error.message?.includes("structure mismatch")) {
            console.error(chalk.red("\n❌ Allotment incompatible with current protocol!"));
            console.log(chalk.yellow(`\n💡 This allotment was created with an older version of the protocol.`));
            console.log(chalk.yellow(`   It doesn't include redemption_count and cannot be used.`));
            console.log(chalk.gray(`\n💡 Solution:`));
            console.log(chalk.gray(`   1. Ask a user to create a new allotment for you`));
            console.log(chalk.gray(`   2. Use: user create-allotment`));
            console.log(chalk.gray(`   3. Then try redeeming again with the new allotment`));
            return;
          } else if (error.message?.includes("Invalid account discriminator") || error.message?.includes("Account does not exist")) {
            // Check if this might be a mandate address instead of an allotment address
            let isMandate = false;
            try {
              const testMandate = await env.clients.agent.getMandate(allotment);
              isMandate = true;
              
              // Find the allotment for this mandate and agent
              const allAllotments = await getAgentAllotments(
                env.wallets.agent.publicKey,
                AUGENPAY_PROGRAM_ID,
                env.connection
              );
              
              // Try to find an allotment that matches this mandate
              let matchingAllotment: PublicKey | null = null;
              for (const allotmentPubkey of allAllotments) {
                try {
                  const allotmentData = await env.clients.agent.getAllotment(allotmentPubkey);
                  if (allotmentData.mandate.toBase58() === allotmentAddr) {
                    matchingAllotment = allotmentPubkey;
                    break;
                  }
                } catch {
                  // Skip incompatible allotments
                  continue;
                }
              }
              
              console.error(chalk.red(`\n❌ You provided a MANDATE address, not an ALLOTMENT address!`));
              console.log(chalk.yellow(`\n💡 Mandate: ${allotmentAddr}`));
              if (matchingAllotment) {
                console.log(chalk.green(`\n✅ Found matching allotment: ${matchingAllotment.toBase58()}`));
                console.log(chalk.gray(`\n💡 Use this command instead:`));
                console.log(chalk.cyan(`   redeem ${matchingAllotment.toBase58()}`));
              } else {
                console.log(chalk.yellow(`\n💡 No allotment found for this mandate.`));
                console.log(chalk.gray(`\n💡 Try:`));
                console.log(chalk.gray(`   1. List your allotments: list-allotments`));
                console.log(chalk.gray(`   2. Use the ALLOTMENT address (first line), not the mandate address`));
              }
              return;
            } catch {
              // Not a mandate either, continue with normal error
            }
            
            console.error(chalk.red(`\n❌ Allotment not found: ${allotmentAddr}`));
            console.log(chalk.yellow(`\n💡 This address doesn't exist on-chain or is not a valid allotment account.`));
            console.log(chalk.gray(`\n💡 Try:`));
            console.log(chalk.gray(`   1. List your allotments: list-allotments`));
            console.log(chalk.gray(`   2. Use the ALLOTMENT address (first line), not the mandate address`));
            console.log(chalk.gray(`   3. Or ask a user to create a new allotment for you`));
            return;
          } else {
            throw error;
          }
        }
        const mandate = allotmentData.mandate;
        const mandateData = await env.clients.agent.getMandate(mandate);
        const mint = mandateData.tokenMint;
        const vault = mandateData.vault;

        const merchant = options.merchant ? new PublicKey(options.merchant) : env.wallets.merchant.publicKey;
        const merchantTokenAccount = await getOrCreateATA(
          env.connection,
          env.wallets.merchant,
          mint,
          merchant
        );

        let amount = options.amount ? Math.floor(options.amount * 1e6) : undefined;
        if (!amount) {
          const answer = await inquirer.prompt([
            {
              type: "number",
              name: "amount",
              message: "Payment amount (in tokens):",
              validate: (value) => (value && value > 0) || "Amount must be greater than 0",
            },
          ]);
          amount = Math.floor(answer.amount * 1e6);
        }

        let orderId = options.orderId;
        if (!orderId) {
          // Generate unique order ID with timestamp and random component
          const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          orderId = `ORD-${uniqueId}`;
          console.log(chalk.gray(`   Order ID: ${orderId} (auto-generated)`));
        }

        // Create order data with unique timestamp
        const orderData = {
          orderId,
          customerEmail: "agent@example.com",
          items: [{ productId: "PROD-1", quantity: 1, price: amount }],
          totalAmount: amount,
          timestamp: Date.now(),
        };

        // Get current redemption count from allotment account
        // The redemption count is stored in the allotment account and increments with each redemption
        // Note: The redemption count will be used by the protocol to derive the ticket PDA
        // We fetch it here for display, but the actual redemption happens in the protocol
        const redemptionCount = allotmentData.redemptionCount || new anchor.BN(0);
        
        console.log(chalk.gray(`   Current redemption count: ${redemptionCount.toString()}`));

        console.log(chalk.cyan("\n💳 Executing payment..."));
        console.log(chalk.gray(`   Allotment: ${allotment.toBase58()}`));
        console.log(chalk.gray(`   Merchant: ${merchant.toBase58()}`));
        console.log(chalk.gray(`   Amount: ${amount / 1e6} tokens`));
        console.log(chalk.gray(`   Order ID: ${orderId}`));

        const { ticket, signature, contextHash } = await env.clients.agent.redeem({
          allotment,
          mandate,
          agent: env.wallets.agent.publicKey,
          merchant,
          merchantTokenAccount,
          vault,
          mint,
          amount,
          orderData,
        });

        saveSession({
          lastTicket: ticket.toBase58(),
          lastMerchantTokenAccount: merchantTokenAccount.toBase58(),
        });

        console.log(chalk.green("\n✅ Payment executed!"));
        console.log(chalk.white(`   Ticket: ${ticket.toBase58()}`));
        console.log(chalk.white(`   Order ID: ${orderId}`));
        console.log(chalk.white(`   Amount: ${amount / 1e6} tokens`));
        console.log(chalk.gray(`   Context Hash: ${Buffer.from(contextHash).toString("hex")}`));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        // Check for AccountDidNotDeserialize error
        if (error.message?.includes("AccountDidNotDeserialize") || error.code === 3003) {
          console.error(chalk.red("\n❌ Allotment incompatible with current protocol!"));
          console.log(chalk.yellow(`\n💡 This allotment was created with an older version of the protocol.`));
          console.log(chalk.yellow(`   It doesn't include redemption_count and cannot be used.`));
          console.log(chalk.gray(`\n💡 Solution:`));
          console.log(chalk.gray(`   1. Ask a user to create a new allotment for you`));
          console.log(chalk.gray(`   2. Use: user create-allotment`));
          console.log(chalk.gray(`   3. Then try redeeming again with the new allotment`));
        } else if (error.message?.includes("MandatePaused") || error.message?.includes("Mandate is paused") || error.code === 6001) {
          console.error(chalk.red(`\n❌ Mandate is paused!`));
          console.log(chalk.yellow(`\n💡 The mandate associated with this allotment has been paused by the user.`));
          console.log(chalk.gray(`\n💡 Solution:`));
          console.log(chalk.gray(`   1. Ask the user to resume the mandate:`));
          console.log(chalk.cyan(`      user resume <mandate-address>`));
          console.log(chalk.gray(`   2. Then try redeeming again`));
        } else {
          console.error(chalk.red(`\n❌ Error: ${error.message}`));
          if (error.logs) {
            console.error(chalk.gray(error.logs.join("\n")));
          }
          // Provide helpful context
          if (error.message.includes("insufficient funds") || error.message.includes("amount")) {
            console.log(chalk.yellow(`\n💡 Check:`));
            console.log(chalk.gray(`   - Allotment has sufficient allowed amount`));
            console.log(chalk.gray(`   - Vault has sufficient balance`));
          }
        }
      }
    });

  // View proofs (tickets)
  agentCmd
    .command("proofs")
    .description("View redemption tickets (payment proofs)")
    .option("-t, --ticket <address>", "Ticket address (uses last if not provided)")
    .action(async (options) => {
      try {
        const ticketAddr = options.ticket || getSession("lastTicket");
        if (!ticketAddr) {
          console.error(chalk.red("❌ No ticket specified. Execute a payment first or provide --ticket"));
          return;
        }

        const ticket = new PublicKey(ticketAddr);
        const ticketData = await env.clients.agent.getTicket(ticket);

        console.log(chalk.cyan("\n🎫 Ticket Information:"));
        console.log(chalk.white(`   Ticket: ${ticket.toBase58()}`));
        console.log(chalk.white(`   Allotment: ${ticketData.allotment.toBase58()}`));
        console.log(chalk.white(`   Merchant: ${ticketData.merchant.toBase58()}`));
        console.log(chalk.white(`   Amount: ${ticketData.amount.toNumber() / 1e6} tokens`));
        console.log(chalk.white(`   Timestamp: ${new Date(ticketData.timestamp.toNumber() * 1000).toLocaleString()}`));
        console.log(chalk.gray(`   Context Hash: ${Buffer.from(ticketData.contextHash).toString("hex")}`));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });
}

