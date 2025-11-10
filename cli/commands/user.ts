/**
 * User Commands
 * Commands for the User role: mandate management, deposits, allotments
 */

import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { Environment, formatTransaction } from "../utils/environment";
import { loadSession, saveSession, getSession } from "../utils/session";
import { getOrCreateATA, getTokenBalance, formatTokenAmount, setupTestEnvironment, createTestToken, mintTokensTo } from "../../utils/tokens";
import { DEVNET_USDC_MINT, DEFAULT_MANDATE_CONFIG, DEFAULT_ALLOTMENT_CONFIG, AUGENPAY_PROGRAM_ID } from "../../config/constants";
import { getUserMandates } from "../../core/pda";
import chalk from "chalk";
import inquirer from "inquirer";

export function createUserCommands(program: Command, env: Environment): void {
  const userCmd = program
    .command("user")
    .description("User role commands - manage mandates, deposits, and allotments");

  // Setup test tokens
  userCmd
    .command("setup-tokens")
    .description("Create test token and mint tokens to all wallets (for testing)")
    .option("-a, --amount <number>", "Amount to mint per wallet (default: 1000)", parseFloat)
    .action(async (options) => {
      try {
        const amount = options.amount ? Math.floor(options.amount * 1e6) : 1000_000000; // Default 1000 tokens

        console.log(chalk.cyan("\n🔧 Setting up test environment..."));
        console.log(chalk.gray(`   Minting ${amount / 1e6} tokens to each wallet`));

        const { mint, tokenAccounts } = await setupTestEnvironment(
          env.connection,
          env.wallets.user,
          [env.wallets.user, env.wallets.agent, env.wallets.merchant],
          amount
        );

        const [userTokenAccount, agentTokenAccount, merchantTokenAccount] = tokenAccounts;

        // Save mint to session
        saveSession({ lastMint: mint.toBase58() });

        console.log(chalk.green("\n✅ Test tokens created!"));
        console.log(chalk.white(`   Mint: ${mint.toBase58()}`));
        console.log(chalk.white(`   User Token Account: ${userTokenAccount.toBase58()}`));
        console.log(chalk.white(`   Agent Token Account: ${agentTokenAccount.toBase58()}`));
        console.log(chalk.white(`   Merchant Token Account: ${merchantTokenAccount.toBase58()}`));

        console.log(chalk.cyan("\n💰 Token Balances:"));
        const userBalance = await getTokenBalance(env.connection, userTokenAccount);
        const agentBalance = await getTokenBalance(env.connection, agentTokenAccount);
        const merchantBalance = await getTokenBalance(env.connection, merchantTokenAccount);

        console.log(chalk.white(`   User: ${formatTokenAmount(userBalance)} tokens`));
        console.log(chalk.white(`   Agent: ${formatTokenAmount(agentBalance)} tokens`));
        console.log(chalk.white(`   Merchant: ${formatTokenAmount(merchantBalance)} tokens`));

        console.log(chalk.yellow("\n💡 Tip: Use this mint address when creating mandates"));
        console.log(chalk.gray(`   Example: user create-mandate -m ${mint.toBase58()}`));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        if (error.logs) {
          console.error(chalk.gray(error.logs.join("\n")));
        }
      }
    });

  // Create mandate
  userCmd
    .command("create-mandate")
    .description("Create a new mandate with vault")
    .option("-m, --mint <address>", "Token mint address (default: creates new test token)")
    .option("-l, --limit <number>", "Per-transaction limit (default: 100)", parseFloat)
    .option("-e, --expiry <days>", "Expiry in days (default: 30)", parseInt)
    .option("--no-mint", "Skip automatic token minting (use existing mint)")
    .action(async (options) => {
      try {
        let mint: PublicKey;
        let shouldMintTokens = !options.noMint; // Default to true unless --no-mint is specified
        
        // If mint is provided, use it
        if (options.mint) {
          mint = new PublicKey(options.mint);
          shouldMintTokens = false; // Don't mint if user specified a mint (they might not have mint authority)
        } else {
          // Check if we have a session mint
          const sessionMint = getSession("lastMint");
          if (sessionMint) {
            mint = new PublicKey(sessionMint);
            console.log(chalk.gray(`   Using session mint: ${mint.toBase58()}`));
          } else {
            // Create a new test token mint
            console.log(chalk.cyan("\n🔧 Creating new test token..."));
            mint = await createTestToken(env.connection, env.wallets.user, 6);
            saveSession({ lastMint: mint.toBase58() });
            console.log(chalk.green(`✅ Test token created: ${mint.toBase58()}`));
          }
        }

        const perTxLimit = options.limit ? Math.floor(options.limit * 1e6) : DEFAULT_MANDATE_CONFIG.perTxLimit;
        const expiryDays = options.expiry || DEFAULT_MANDATE_CONFIG.expiryDays;

        console.log(chalk.cyan("\n🧾 Creating mandate..."));
        console.log(chalk.gray(`   Owner: ${env.wallets.user.publicKey.toBase58()}`));
        console.log(chalk.gray(`   Mint: ${mint.toBase58()}`));
        console.log(chalk.gray(`   Limit: ${perTxLimit / 1e6} tokens`));
        console.log(chalk.gray(`   Expiry: ${expiryDays} days`));

        const { mandate, vault, signature } = await env.clients.user.createMandate(
          env.wallets.user.publicKey,
          mint,
          { perTxLimit, expiryDays }
        );

        saveSession({
          lastMandate: mandate.toBase58(),
          lastVault: vault.toBase58(),
          lastMint: mint.toBase58(),
        });

        console.log(chalk.green("\n🧾 Mandate created!"));
        console.log(chalk.white(`   Owner: ${env.wallets.user.publicKey.toBase58()}`));
        console.log(chalk.white(`   Mandate: ${mandate.toBase58()}`));
        console.log(chalk.white(`   Vault: ${vault.toBase58()}`));
        console.log(chalk.white(`   Limit: ${perTxLimit / 1e6} tokens`));
        console.log(chalk.white(`   Expiry: ${new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}`));
        console.log(formatTransaction(signature, env.cluster));

        // Mint 100k tokens to each wallet if shouldMintTokens is true
        // Only mint if we didn't specify a mint (i.e., using session mint or new mint)
        if (shouldMintTokens && !options.mint) {
          console.log(chalk.cyan("\n💰 Minting 100,000 tokens to each wallet..."));
          const mintAmount = 100_000_000000; // 100k tokens with 6 decimals
          
          // Get or create token accounts for all wallets
          const userTokenAccount = await getOrCreateATA(
            env.connection,
            env.wallets.user,
            mint,
            env.wallets.user.publicKey
          );
          const agentTokenAccount = await getOrCreateATA(
            env.connection,
            env.wallets.user,
            mint,
            env.wallets.agent.publicKey
          );
          const merchantTokenAccount = await getOrCreateATA(
            env.connection,
            env.wallets.user,
            mint,
            env.wallets.merchant.publicKey
          );

          // Mint tokens to each account
          await mintTokensTo(env.connection, env.wallets.user, mint, userTokenAccount, mintAmount);
          await mintTokensTo(env.connection, env.wallets.user, mint, agentTokenAccount, mintAmount);
          await mintTokensTo(env.connection, env.wallets.user, mint, merchantTokenAccount, mintAmount);

          console.log(chalk.green("\n✅ Tokens minted!"));
          console.log(chalk.white(`   User Token Account: ${userTokenAccount.toBase58()}`));
          console.log(chalk.white(`   Agent Token Account: ${agentTokenAccount.toBase58()}`));
          console.log(chalk.white(`   Merchant Token Account: ${merchantTokenAccount.toBase58()}`));

          const userBalance = await getTokenBalance(env.connection, userTokenAccount);
          const agentBalance = await getTokenBalance(env.connection, agentTokenAccount);
          const merchantBalance = await getTokenBalance(env.connection, merchantTokenAccount);

          console.log(chalk.cyan("\n💰 Token Balances:"));
          console.log(chalk.white(`   User: ${formatTokenAmount(userBalance)} tokens`));
          console.log(chalk.white(`   Agent: ${formatTokenAmount(agentBalance)} tokens`));
          console.log(chalk.white(`   Merchant: ${formatTokenAmount(merchantBalance)} tokens`));
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        if (error.logs) {
          console.error(chalk.gray(error.logs.join("\n")));
        }
      }
    });

  // Deposit
  userCmd
    .command("deposit")
    .description("Deposit tokens into mandate vault")
    .option("-a, --amount <number>", "Amount to deposit (in tokens)", parseFloat)
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        // Allow mandate as option (positional args are converted to --mandate in CLI)
        let mandateAddr = options.mandate || getSession("lastMandate");
        
        // If no mandate specified, let user choose from their mandates
        if (!mandateAddr) {
          console.log(chalk.cyan("\n🔍 Fetching your mandates..."));
          const mandates = await getUserMandates(
            env.wallets.user.publicKey,
            AUGENPAY_PROGRAM_ID,
            env.connection
          );

          if (mandates.length === 0) {
            console.error(chalk.red("❌ No mandates found. Create one first with: create-mandate"));
            return;
          }

          if (mandates.length === 1) {
            mandateAddr = mandates[0].toBase58();
            console.log(chalk.gray(`   Using your only mandate: ${mandateAddr}`));
          } else {
            // Fetch mandate data for better display
            const mandateChoices = await Promise.all(
              mandates.map(async (mandate) => {
                try {
                  const mandateData = await env.clients.user.getMandate(mandate);
                  const vaultBalance = await getTokenBalance(env.connection, mandateData.vault);
                  const isLast = mandate.toBase58() === getSession("lastMandate");
                  
                  return {
                    name: `${mandate.toBase58()} ${isLast ? "(last used)" : ""} - ${formatTokenAmount(vaultBalance, 6)} tokens - ${mandateData.paused ? "PAUSED" : "ACTIVE"}`,
                    value: mandate.toBase58(),
                  };
                } catch {
                  return {
                    name: `${mandate.toBase58()} (error loading)`,
                    value: mandate.toBase58(),
                  };
                }
              })
            );

            const answer = await inquirer.prompt([
              {
                type: "list",
                name: "mandate",
                message: "Select mandate to deposit into:",
                choices: mandateChoices,
              },
            ]);
            mandateAddr = answer.mandate;
          }
        }

        const mandate = new PublicKey(mandateAddr);
        const mandateData = await env.clients.user.getMandate(mandate);
        const mint = mandateData.tokenMint;
        const vault = mandateData.vault;

        let amount = options.amount ? Math.floor(options.amount * 1e6) : undefined;
        if (!amount) {
          const answer = await inquirer.prompt([
            {
              type: "number",
              name: "amount",
              message: "Amount to deposit (in tokens):",
              validate: (value) => (value && value > 0) || "Amount must be greater than 0",
            },
          ]);
          amount = Math.floor(answer.amount * 1e6);
        }

        // Get or create user token account
        const userTokenAccount = await getOrCreateATA(
          env.connection,
          env.wallets.user,
          mint,
          env.wallets.user.publicKey
        );

        const balance = await getTokenBalance(env.connection, userTokenAccount);
        if (balance < BigInt(amount)) {
          console.error(chalk.red(`\n❌ Insufficient balance. You have ${formatTokenAmount(balance, 6)} tokens`));
          console.log(chalk.yellow(`\n💡 Mandate uses mint: ${mint.toBase58()}`));
          console.log(chalk.yellow(`   Your token account: ${userTokenAccount.toBase58()}`));
          console.log(chalk.gray(`\n💡 This mandate was created with a different token mint than your test tokens.`));
          console.log(chalk.gray(`   Solution:`));
          console.log(chalk.gray(`   1. Create a new mandate with the test token mint:`));
          const sessionMint = getSession("lastMint");
          if (sessionMint) {
            console.log(chalk.cyan(`      user create-mandate -m ${sessionMint}`));
          } else {
            console.log(chalk.cyan(`      user create-mandate -m <your-test-token-mint>`));
          }
          console.log(chalk.gray(`   2. Or create new test tokens with this mint:`));
          console.log(chalk.cyan(`      user setup-tokens`));
          return;
        }

        console.log(chalk.cyan("\n💰 Depositing tokens..."));
        console.log(chalk.gray(`   Amount: ${amount / 1e6} tokens`));
        console.log(chalk.gray(`   Mandate: ${mandate.toBase58()}`));

        const signature = await env.clients.user.deposit(
          mandate,
          userTokenAccount,
          vault,
          mint,
          env.wallets.user.publicKey,
          amount
        );

        saveSession({ lastUserTokenAccount: userTokenAccount.toBase58() });

        console.log(chalk.green("\n✅ Deposit successful!"));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        if (error.logs) {
          console.error(chalk.gray(error.logs.join("\n")));
        }
      }
    });

  // Create allotment
  userCmd
    .command("create-allotment")
    .description("Create spending allotment for agent")
    .option("-a, --amount <number>", "Allowed amount (in tokens)", parseFloat)
    .option("-t, --ttl <hours>", "Time to live in hours (default: 24)", parseInt)
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        // Allow mandate as option (positional args are converted to --mandate in CLI)
        let mandateAddr = options.mandate || getSession("lastMandate");
        
        // If no mandate specified, let user choose from their mandates
        if (!mandateAddr) {
          console.log(chalk.cyan("\n🔍 Fetching your mandates..."));
          const mandates = await getUserMandates(
            env.wallets.user.publicKey,
            AUGENPAY_PROGRAM_ID,
            env.connection
          );

          if (mandates.length === 0) {
            console.error(chalk.red("❌ No mandates found. Create one first with: create-mandate"));
            return;
          }

          if (mandates.length === 1) {
            mandateAddr = mandates[0].toBase58();
            console.log(chalk.gray(`   Using your only mandate: ${mandateAddr}`));
          } else {
            // Fetch mandate data for better display
            const mandateChoices = await Promise.all(
              mandates.map(async (mandate) => {
                try {
                  const mandateData = await env.clients.user.getMandate(mandate);
                  const vaultBalance = await getTokenBalance(env.connection, mandateData.vault);
                  const isLast = mandate.toBase58() === getSession("lastMandate");
                  
                  return {
                    name: `${mandate.toBase58()} ${isLast ? "(last used)" : ""} - ${formatTokenAmount(vaultBalance, 6)} tokens - ${mandateData.paused ? "PAUSED" : "ACTIVE"}`,
                    value: mandate.toBase58(),
                  };
                } catch {
                  return {
                    name: `${mandate.toBase58()} (error loading)`,
                    value: mandate.toBase58(),
                  };
                }
              })
            );

            const answer = await inquirer.prompt([
              {
                type: "list",
                name: "mandate",
                message: "Select mandate to create allotment from:",
                choices: mandateChoices,
              },
            ]);
            mandateAddr = answer.mandate;
          }
        }

        const mandate = new PublicKey(mandateAddr);
        const mandateData = await env.clients.user.getMandate(mandate);
        const allowedAmount = options.amount ? Math.floor(options.amount * 1e6) : DEFAULT_ALLOTMENT_CONFIG.allowedAmount;
        const ttlHours = options.ttl || DEFAULT_ALLOTMENT_CONFIG.ttlHours;

        console.log(chalk.cyan("\n🎫 Creating allotment..."));
        console.log(chalk.gray(`   Mandate: ${mandate.toBase58()}`));
        console.log(chalk.gray(`   Agent: ${env.wallets.agent.publicKey.toBase58()}`));
        console.log(chalk.gray(`   Amount: ${allowedAmount / 1e6} tokens`));
        console.log(chalk.gray(`   TTL: ${ttlHours} hours`));

        // Check vault balance before creating allotment
        const vaultBalance = await getTokenBalance(env.connection, mandateData.vault);
        if (vaultBalance < BigInt(allowedAmount)) {
          console.error(chalk.red(`\n❌ Insufficient funds in mandate vault!`));
          console.log(chalk.yellow(`\n💡 Vault balance: ${formatTokenAmount(vaultBalance, 6)} tokens`));
          console.log(chalk.yellow(`   Required for allotment: ${formatTokenAmount(allowedAmount, 6)} tokens`));
          console.log(chalk.gray(`\n💡 Solution:`));
          console.log(chalk.gray(`   1. Deposit tokens into the mandate vault first:`));
          console.log(chalk.cyan(`      user deposit ${mandate.toBase58()} -a ${allowedAmount / 1e6}`));
          console.log(chalk.gray(`   2. Or deposit a larger amount:`));
          console.log(chalk.cyan(`      user deposit ${mandate.toBase58()} -a <amount>`));
          return;
        }

        const { allotment, signature } = await env.clients.user.createAllotment(
          mandate,
          env.wallets.agent.publicKey,
          env.wallets.user.publicKey,
          { allowedAmount, ttlHours }
        );

        saveSession({ lastAllotment: allotment.toBase58() });

        console.log(chalk.green("\n✅ Allotment created!"));
        console.log(chalk.white(`   Allotment: ${allotment.toBase58()}`));
        console.log(chalk.white(`   Agent: ${env.wallets.agent.publicKey.toBase58()}`));
        console.log(chalk.white(`   Amount: ${allowedAmount / 1e6} tokens`));
        console.log(chalk.white(`   TTL: ${ttlHours} hours`));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        // Check for InsufficientFunds error from the program
        if (error.message?.includes("InsufficientFunds") || error.message?.includes("Insufficient funds") || error.code === 6000) {
          const currentMandateAddr = options.mandate || getSession("lastMandate") || "<mandate-address>";
          console.error(chalk.red(`\n❌ Insufficient funds in mandate vault!`));
          console.log(chalk.yellow(`\n💡 The mandate vault doesn't have enough tokens to cover this allotment.`));
          console.log(chalk.gray(`\n💡 Solution:`));
          console.log(chalk.gray(`   1. Check vault balance:`));
          console.log(chalk.cyan(`      user view ${currentMandateAddr}`));
          console.log(chalk.gray(`   2. Deposit tokens into the mandate vault:`));
          console.log(chalk.cyan(`      user deposit ${currentMandateAddr} -a <amount>`));
          console.log(chalk.gray(`   3. Then create the allotment again`));
        } else {
          console.error(chalk.red(`\n❌ Error: ${error.message}`));
          if (error.logs) {
            console.error(chalk.gray(error.logs.join("\n")));
          }
        }
      }
    });

  // Pause mandate
  userCmd
    .command("pause")
    .description("Pause a mandate")
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        const mandateAddr = options.mandate || getSession("lastMandate");
        if (!mandateAddr) {
          console.error(chalk.red("❌ No mandate specified"));
          return;
        }

        const mandate = new PublicKey(mandateAddr);
        console.log(chalk.cyan("\n⏸️  Pausing mandate..."));

        const signature = await env.clients.user.pauseMandate(mandate, env.wallets.user.publicKey);

        console.log(chalk.green("\n✅ Mandate paused!"));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // Resume mandate
  userCmd
    .command("resume")
    .description("Resume a paused mandate")
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        const mandateAddr = options.mandate || getSession("lastMandate");
        if (!mandateAddr) {
          console.error(chalk.red("❌ No mandate specified"));
          return;
        }

        const mandate = new PublicKey(mandateAddr);
        console.log(chalk.cyan("\n▶️  Resuming mandate..."));

        const signature = await env.clients.user.resumeMandate(mandate, env.wallets.user.publicKey);

        console.log(chalk.green("\n✅ Mandate resumed!"));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // Withdraw
  userCmd
    .command("withdraw")
    .description("Withdraw tokens from mandate vault")
    .option("-a, --amount <number>", "Amount to withdraw (in tokens)", parseFloat)
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        const mandateAddr = options.mandate || getSession("lastMandate");
        if (!mandateAddr) {
          console.error(chalk.red("❌ No mandate specified"));
          return;
        }

        const mandate = new PublicKey(mandateAddr);
        const mandateData = await env.clients.user.getMandate(mandate);
        const mint = mandateData.tokenMint;
        const vault = mandateData.vault;

        let amount = options.amount ? Math.floor(options.amount * 1e6) : undefined;
        if (!amount) {
          const answer = await inquirer.prompt([
            {
              type: "number",
              name: "amount",
              message: "Amount to withdraw (in tokens):",
              validate: (value) => (value && value > 0) || "Amount must be greater than 0",
            },
          ]);
          amount = Math.floor(answer.amount * 1e6);
        }

        const toTokenAccount = await getOrCreateATA(
          env.connection,
          env.wallets.user,
          mint,
          env.wallets.user.publicKey
        );

        console.log(chalk.cyan("\n💸 Withdrawing tokens..."));
        console.log(chalk.gray(`   Amount: ${amount / 1e6} tokens`));

        const signature = await env.clients.user.withdraw(
          mandate,
          vault,
          toTokenAccount,
          mint,
          env.wallets.user.publicKey,
          amount
        );

        console.log(chalk.green("\n✅ Withdrawal successful!"));
        console.log(formatTransaction(signature, env.cluster));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // List mandates
  userCmd
    .command("list")
    .description("List all mandates for this user")
    .action(async () => {
      try {
        console.log(chalk.cyan("\n🔍 Fetching your mandates..."));
        const mandates = await getUserMandates(
          env.wallets.user.publicKey,
          AUGENPAY_PROGRAM_ID,
          env.connection
        );

        if (mandates.length === 0) {
          console.log(chalk.yellow("\n📭 No mandates found"));
          console.log(chalk.gray("   Create one with: create-mandate"));
          return;
        }

        console.log(chalk.green(`\n✅ Found ${mandates.length} mandate(s):\n`));
        for (let i = 0; i < mandates.length; i++) {
          try {
            const mandateData = await env.clients.user.getMandate(mandates[i]);
            const vaultBalance = await getTokenBalance(env.connection, mandateData.vault);
            const isLast = mandates[i].toBase58() === getSession("lastMandate");
            
            console.log(chalk.cyan(`${i + 1}. ${isLast ? "⭐ " : ""}${mandates[i].toBase58()}`));
            console.log(chalk.white(`   Mint: ${mandateData.tokenMint.toBase58()}`));
            console.log(chalk.white(`   Balance: ${formatTokenAmount(vaultBalance, 6)} tokens`));
            console.log(chalk.white(`   Limit: ${mandateData.perTxLimit.toNumber() / 1e6} tokens/tx`));
            console.log(chalk.white(`   Paused: ${mandateData.paused ? "Yes" : "No"}`));
            console.log(chalk.gray(`   Expiry: ${new Date(mandateData.expiry.toNumber() * 1000).toLocaleString()}`));
            console.log();
          } catch (error: any) {
            console.log(chalk.red(`${i + 1}. ${mandates[i].toBase58()} (Error: ${error.message})`));
            console.log();
          }
        }
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  // View mandate
  userCmd
    .command("view")
    .description("View mandate and allotment information")
    .option("-m, --mandate <address>", "Mandate address (uses last if not provided)")
    .action(async (options) => {
      try {
        let mandateAddr = options.mandate || getSession("lastMandate");
        
        // If no mandate specified, let user choose from their mandates
        if (!mandateAddr) {
          console.log(chalk.cyan("\n🔍 Fetching your mandates..."));
          const mandates = await getUserMandates(
            env.wallets.user.publicKey,
            AUGENPAY_PROGRAM_ID,
            env.connection
          );

          if (mandates.length === 0) {
            console.error(chalk.red("❌ No mandates found. Create one first with: create-mandate"));
            return;
          }

          if (mandates.length === 1) {
            mandateAddr = mandates[0].toBase58();
            console.log(chalk.gray(`   Using your only mandate: ${mandateAddr}`));
          } else {
            const choices = mandates.map((m, i) => ({
              name: `${m.toBase58()} ${m.toBase58() === getSession("lastMandate") ? "(last used)" : ""}`,
              value: m.toBase58(),
            }));

            const answer = await inquirer.prompt([
              {
                type: "list",
                name: "mandate",
                message: "Select mandate to view:",
                choices,
              },
            ]);
            mandateAddr = answer.mandate;
          }
        }

        const mandate = new PublicKey(mandateAddr);
        const mandateData = await env.clients.user.getMandate(mandate);

        console.log(chalk.cyan("\n📋 Mandate Information:"));
        console.log(chalk.white(`   Owner: ${mandateData.owner.toBase58()}`));
        console.log(chalk.white(`   Mandate: ${mandate.toBase58()}`));
        console.log(chalk.white(`   Vault: ${mandateData.vault.toBase58()}`));
        console.log(chalk.white(`   Mint: ${mandateData.tokenMint.toBase58()}`));
        console.log(chalk.white(`   Per-Tx Limit: ${mandateData.perTxLimit.toNumber() / 1e6} tokens`));
        console.log(chalk.white(`   Paused: ${mandateData.paused ? "Yes" : "No"}`));
        console.log(chalk.white(`   Expiry: ${new Date(mandateData.expiry.toNumber() * 1000).toLocaleString()}`));

        const vaultBalance = await getTokenBalance(env.connection, mandateData.vault);
        console.log(chalk.white(`   Vault Balance: ${formatTokenAmount(vaultBalance, 6)} tokens`));
      } catch (error: any) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });
}

