/**
 * Merchant Commands
 * Commands for the Merchant role: verify payments, list tickets
 */

import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Environment, formatTransaction } from "../utils/environment";
import { getSession, updateSession } from "../utils/session";
import chalk from "chalk";
import inquirer from "inquirer";

export function createMerchantCommands(program: Command, env: Environment): void {
  const merchantCmd = program
    .command("merchant")
    .description("Merchant role commands - verify payments and list tickets");

  // Verify ticket
  merchantCmd
    .command("verify")
    .description("Verify a payment ticket on-chain")
    .option("-t, --ticket <address>", "Ticket address (uses last if not provided)")
    .option("-h, --hash <hex>", "Expected order hash (optional)")
    .action(async (options) => {
      try {
        // Allow ticket as option (positional args are converted to --ticket in CLI)
        let ticketAddr = options.ticket;
        const sessionTicket = getSession("lastTicket");
        
        // If no ticket specified, fetch all tickets and let user select
        if (!ticketAddr) {
          if (sessionTicket) {
            // Try to use session ticket first
            try {
              const testTicket = new PublicKey(sessionTicket);
              const testData = await env.clients.merchant.getTicket(testTicket);
              if (testData.merchant.equals(env.wallets.merchant.publicKey)) {
                ticketAddr = sessionTicket;
                console.log(chalk.gray(`   Using last ticket: ${ticketAddr}`));
              }
            } catch {
              // Session ticket invalid, continue to fetch all tickets
            }
          }
          
          if (!ticketAddr) {
            // Fetch all merchant tickets
            console.log(chalk.cyan("\n🔍 Fetching your tickets..."));
            const tickets = await env.clients.merchant.getMerchantTickets(env.wallets.merchant.publicKey);
            
            if (tickets.length === 0) {
              console.error(chalk.red("\n❌ No tickets found for this merchant"));
              console.log(chalk.yellow("💡 Wait for an agent to make a payment first"));
              return;
            }
            
            if (tickets.length === 1) {
              ticketAddr = tickets[0].pubkey.toBase58();
              console.log(chalk.gray(`   Using your only ticket: ${ticketAddr}`));
            } else {
              // Create choices from tickets
              const ticketChoices = tickets.map((ticket, index) => {
                const amount = ticket.account.amount.toNumber() / 1e6;
                const timestamp = new Date(ticket.account.timestamp.toNumber() * 1000).toLocaleString();
                const hash = Buffer.from(ticket.account.contextHash).toString("hex").substring(0, 16) + "...";
                const isLast = ticket.pubkey.toBase58() === sessionTicket;
                
                return {
                  name: `${ticket.pubkey.toBase58()} ${isLast ? "(last used)" : ""} - ${amount} tokens - ${timestamp}`,
                  value: ticket.pubkey.toBase58(),
                };
              });
              
              const answer = await inquirer.prompt([
                {
                  type: "list",
                  name: "ticket",
                  message: "Select ticket to verify:",
                  choices: ticketChoices,
                },
              ]);
              ticketAddr = answer.ticket;
            }
          }
        }

        // Validate ticket address format
        let ticket: PublicKey;
        try {
          ticket = new PublicKey(ticketAddr);
        } catch (error: any) {
          console.error(chalk.red(`\n❌ Invalid ticket address: ${ticketAddr}`));
          console.log(chalk.yellow("💡 Make sure the address is a valid Solana public key"));
          return;
        }

        console.log(chalk.cyan("\n🔍 Verifying ticket..."));
        console.log(chalk.gray(`   Ticket: ${ticket.toBase58()}`));
        console.log(chalk.gray(`   Merchant: ${env.wallets.merchant.publicKey.toBase58()}`));

        // Fetch ticket data with error handling
        let ticketData;
        try {
          ticketData = await env.clients.merchant.getTicket(ticket);
        } catch (error: any) {
          if (error.message?.includes("Invalid account discriminator") || error.message?.includes("Account does not exist")) {
            console.error(chalk.red(`\n❌ Ticket not found: ${ticketAddr}`));
            console.log(chalk.yellow(`\n💡 This ticket address doesn't exist on-chain or is not a valid ticket account.`));
            console.log(chalk.gray(`\n💡 Try:`));
            console.log(chalk.gray(`   1. List your tickets: list`));
            console.log(chalk.gray(`   2. Or wait for an agent to make a payment`));
            return;
          } else {
            throw error;
          }
        }

        // Verify it belongs to this merchant
        if (!ticketData.merchant.equals(env.wallets.merchant.publicKey)) {
          console.error(chalk.red("\n❌ This ticket does not belong to this merchant"));
          console.log(chalk.yellow(`\n💡 Ticket merchant: ${ticketData.merchant.toBase58()}`));
          console.log(chalk.yellow(`   Your merchant: ${env.wallets.merchant.publicKey.toBase58()}`));
          return;
        }

        // If hash provided, verify it matches
        let hashValid = true;
        if (options.hash) {
          const expectedHash = Buffer.from(options.hash, "hex");
          const actualHash = Buffer.from(ticketData.contextHash);
          hashValid = expectedHash.equals(actualHash);
          
          if (!hashValid) {
            console.error(chalk.red("\n❌ Hash mismatch!"));
            console.log(chalk.gray(`   Expected: ${options.hash}`));
            console.log(chalk.gray(`   Actual: ${Buffer.from(ticketData.contextHash).toString("hex")}`));
            return;
          }
        }

        // Save to session
        updateSession("lastTicket", ticket.toBase58());

        // Display verification results
        console.log(chalk.green("\n✅ Ticket verified!"));
        console.log(chalk.white(`\n📋 Ticket Details:`));
        console.log(chalk.white(`   Ticket: ${chalk.bold(ticket.toBase58())}`));
        console.log(chalk.white(`   Merchant: ${ticketData.merchant.toBase58()}`));
        console.log(chalk.white(`   Allotment: ${ticketData.allotment.toBase58()}`));
        console.log(chalk.white(`   Amount: ${chalk.bold(ticketData.amount.toNumber() / 1e6)} tokens`));
        console.log(chalk.white(`   Timestamp: ${new Date(ticketData.timestamp.toNumber() * 1000).toLocaleString()}`));
        console.log(chalk.gray(`   Context Hash: ${Buffer.from(ticketData.contextHash).toString("hex")}`));
        
        if (options.hash && hashValid) {
          console.log(chalk.green(`\n✅ Hash verification: PASSED`));
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // List all tickets
  merchantCmd
    .command("list")
    .description("List all payment tickets for this merchant")
    .action(async () => {
      try {
        console.log(chalk.cyan("\n🔍 Fetching merchant tickets..."));
        console.log(chalk.gray(`   Merchant: ${env.wallets.merchant.publicKey.toBase58()}`));

        const tickets = await env.clients.merchant.getMerchantTickets(env.wallets.merchant.publicKey);

        if (tickets.length === 0) {
          console.log(chalk.yellow("\n📭 No tickets found"));
          return;
        }

        console.log(chalk.green(`\n✅ Found ${tickets.length} ticket(s):\n`));
        const sessionTicket = getSession("lastTicket");
        tickets.forEach((ticket, index) => {
          const isLast = ticket.pubkey.toBase58() === sessionTicket;
          console.log(chalk.cyan(`${index + 1}. ${chalk.bold(ticket.pubkey.toBase58())} ${isLast ? chalk.gray("(last used)") : ""} ${chalk.gray("← Use this for verify!")}`));
          console.log(chalk.white(`   Amount: ${ticket.account.amount.toNumber() / 1e6} tokens`));
          console.log(chalk.white(`   Allotment: ${ticket.account.allotment.toBase58()}`));
          console.log(chalk.white(`   Timestamp: ${new Date(ticket.account.timestamp.toNumber() * 1000).toLocaleString()}`));
          console.log(chalk.gray(`   Context Hash (Order Hash): ${Buffer.from(ticket.account.contextHash).toString("hex")}`));
          console.log();
        });
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // Find ticket by hash
  merchantCmd
    .command("find")
    .description("Find ticket by order hash")
    .option("-h, --hash <hex>", "Order hash (hex string)", (value) => value)
    .action(async (options) => {
      try {
        if (!options.hash) {
          console.error(chalk.red("❌ Hash required. Use --hash <hex>"));
          return;
        }

        const hashBytes = Buffer.from(options.hash, "hex");
        if (hashBytes.length !== 32) {
          console.error(chalk.red("❌ Invalid hash. Must be 32 bytes (64 hex characters)"));
          return;
        }

        console.log(chalk.cyan("\n🔍 Searching for ticket..."));
        console.log(chalk.gray(`   Order Hash: ${options.hash}`));
        console.log(chalk.gray(`   Merchant: ${env.wallets.merchant.publicKey.toBase58()}`));

        const ticket = await env.clients.merchant.findTicketByHash(
          env.wallets.merchant.publicKey,
          Array.from(hashBytes)
        );

        if (!ticket) {
          console.log(chalk.yellow("\n📭 No ticket found with this hash"));
          return;
        }

        console.log(chalk.green("\n✅ Ticket found!"));
        console.log(chalk.white(`   Ticket: ${ticket.pubkey.toBase58()}`));
        console.log(chalk.white(`   Amount: ${ticket.account.amount.toNumber() / 1e6} tokens`));
        console.log(chalk.white(`   Timestamp: ${new Date(ticket.account.timestamp.toNumber() * 1000).toLocaleString()}`));
        console.log(chalk.gray(`   Context Hash (Order Hash): ${Buffer.from(ticket.account.contextHash).toString("hex")}`));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });
}

