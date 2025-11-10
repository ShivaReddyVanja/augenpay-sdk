#!/usr/bin/env ts-node

/**
 * AugenPay CLI
 * Interactive command-line interface for the AugenPay SDK
 * 
 * Usage:
 *   yarn cli
 *   yarn cli user create-mandate
 *   yarn cli agent redeem
 *   yarn cli merchant verify
 */

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import { initializeEnvironment, displayEnvironmentSummary } from "./utils/environment";
import { createUserCommands } from "./commands/user";
import { createAgentCommands } from "./commands/agent";
import { createMerchantCommands } from "./commands/merchant";
import { CLUSTER_ENDPOINTS, DEFAULT_CLUSTER } from "../config/constants";

const program = new Command();

program
  .name("augenpay-cli")
  .description("AugenPay CLI - Interactive SDK for payment delegation")
  .version("1.0.0");

// Global options
program
  .option("-c, --cluster <cluster>", "Solana cluster (devnet, mainnet, localnet)", "devnet")
  .option("--no-interactive", "Skip role selection, use direct commands");

async function main() {
  // Check if direct command mode (role specified)
  const args = process.argv.slice(2);
  const isDirectMode = args.length > 0 && (args[0] === "user" || args[0] === "agent" || args[0] === "merchant");
  
  // Parse options (but don't execute yet if direct mode)
  const cluster = args.includes("--cluster") 
    ? (args[args.indexOf("--cluster") + 1] as keyof typeof CLUSTER_ENDPOINTS) || DEFAULT_CLUSTER
    : DEFAULT_CLUSTER;

  // Initialize environment
  console.log(chalk.cyan("\n🚀 Initializing AugenPay CLI..."));
  const env = await initializeEnvironment(cluster);
  await displayEnvironmentSummary(env);

  // If commands provided directly (role specified), skip role selection
  if (isDirectMode) {
    // Handle positional arguments in direct mode
    const role = args[0];
    const command = args[1];
    const remainingArgs = args.slice(2);
    
    // Special handling for commands that accept positional arguments
    const commandsWithPositionalMandate = ["pause", "resume", "withdraw", "view", "create-allotment", "deposit"];
    const commandsWithPositionalAllotment = ["redeem"];
    const commandsWithPositionalTicket = ["verify"];
    
    if (command && remainingArgs.length > 0) {
      const firstArg = remainingArgs[0];
      // Check if it looks like a Solana public key (base58, 32-44 chars)
      if (firstArg.length >= 32 && firstArg.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(firstArg) && !firstArg.startsWith("-")) {
        if (commandsWithPositionalMandate.includes(command)) {
          // Convert positional argument to --mandate option
          remainingArgs[0] = `--mandate=${firstArg}`;
        } else if (commandsWithPositionalAllotment.includes(command)) {
          // Convert positional argument to --allotment option
          remainingArgs[0] = `--allotment=${firstArg}`;
        } else if (commandsWithPositionalTicket.includes(command)) {
          // Convert positional argument to --ticket option
          remainingArgs[0] = `--ticket=${firstArg}`;
        }
      }
    }
    
    // Reconstruct process.argv with converted arguments
    const newArgs = [process.argv[0], process.argv[1], role, command, ...remainingArgs];
    process.argv = newArgs;
    
    // Register all commands
    createUserCommands(program, env);
    createAgentCommands(program, env);
    createMerchantCommands(program, env);
    
    // Parse and execute
    await program.parseAsync(process.argv);
    return;
  }

  // Interactive mode: role selection
  const { role } = await inquirer.prompt([
    {
      type: "list",
      name: "role",
      message: "Select your role:",
      choices: [
        { name: "👤 User - Manage mandates, deposits, and allotments", value: "user" },
        { name: "🤖 Agent - Execute payments using allotments", value: "agent" },
        { name: "🏪 Merchant - Verify payments and list tickets", value: "merchant" },
        { name: "❌ Exit", value: "exit" },
      ],
    },
  ]);

  if (role === "exit") {
    console.log(chalk.gray("\n👋 Goodbye!"));
    process.exit(0);
  }

  // Create role-specific command program
  const roleProgram = new Command();
  roleProgram.name(role);

  // Register commands for selected role
  if (role === "user") {
    createUserCommands(roleProgram, env);
  } else if (role === "agent") {
    createAgentCommands(roleProgram, env);
  } else if (role === "merchant") {
    createMerchantCommands(roleProgram, env);
  }

  // Custom help display function
  const displayHelp = () => {
    console.log(chalk.cyan(`\n📋 Available ${role.toUpperCase()} Commands:\n`));
    
    const commands = roleProgram.commands.filter(cmd => cmd.name() !== role);
    
    if (role === "user") {
      console.log(chalk.white("  setup-tokens      Create test token and mint to all wallets (for testing)"));
      console.log(chalk.white("  create-mandate    Create a new mandate with vault"));
      console.log(chalk.white("  list              List all mandates for this user"));
      console.log(chalk.white("  deposit           Deposit tokens into mandate vault"));
      console.log(chalk.white("  create-allotment  Create spending allotment for agent"));
      console.log(chalk.white("  pause             Pause a mandate"));
      console.log(chalk.white("  resume            Resume a paused mandate"));
      console.log(chalk.white("  withdraw          Withdraw tokens from mandate vault"));
      console.log(chalk.white("  view              View mandate and allotment information"));
    } else if (role === "agent") {
      console.log(chalk.white("  list-allotments   List available allotments for this agent"));
      console.log(chalk.white("  redeem            Execute payment using an allotment"));
      console.log(chalk.white("  proofs            View redemption tickets (payment proofs)"));
    } else if (role === "merchant") {
      console.log(chalk.white("  verify            Verify a payment ticket on-chain"));
      console.log(chalk.white("  list              List all payment tickets for this merchant"));
      console.log(chalk.white("  find              Find ticket by order hash"));
    }
    
    console.log(chalk.gray("\n  help              Show this help message"));
    console.log(chalk.gray("  exit              Exit the CLI\n"));
    console.log(chalk.yellow("💡 Tip: Enter just the command name (e.g., 'create-mandate') without the role prefix\n"));
  };

  // Show help initially
  displayHelp();

  // Interactive command loop
  while (true) {
    const { command } = await inquirer.prompt([
      {
        type: "input",
        name: "command",
        message: `\n${chalk.cyan(`[${role}]`)} Enter command${chalk.gray(" (or 'help' / 'exit')")}:`,
      },
    ]);

    if (command === "exit" || command === "quit") {
      console.log(chalk.gray("\n👋 Goodbye!"));
      break;
    }

    if (command === "help" || command === "h") {
      displayHelp();
      continue;
    }

    if (!command.trim()) {
      continue;
    }

    // Parse and execute command
    try {
      const cmdParts = command.trim().split(/\s+/);
      const cmdName = cmdParts[0];
      const cmdArgs = cmdParts.slice(1);
      
      // Special handling for commands that accept positional arguments
      // Convert positional arguments to options for better Commander.js compatibility
      const commandsWithPositionalMandate = ["pause", "resume", "withdraw", "view", "create-allotment", "deposit"];
      const commandsWithPositionalAllotment = ["redeem"];
      const commandsWithPositionalTicket = ["verify"];
      
      if (cmdArgs.length > 0) {
        const firstArg = cmdArgs[0];
        // Check if it looks like a Solana public key (base58, 32-44 chars)
        if (firstArg.length >= 32 && firstArg.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(firstArg) && !firstArg.startsWith("-")) {
          if (commandsWithPositionalMandate.includes(cmdName)) {
            // Convert positional argument to --mandate option
            cmdArgs[0] = `--mandate=${firstArg}`;
          } else if (commandsWithPositionalAllotment.includes(cmdName)) {
            // Convert positional argument to --allotment option
            cmdArgs[0] = `--allotment=${firstArg}`;
          } else if (commandsWithPositionalTicket.includes(cmdName)) {
            // Convert positional argument to --ticket option
            cmdArgs[0] = `--ticket=${firstArg}`;
          }
        }
      }
      
      // Create a new program instance for each command to avoid state issues
      const cmdProgram = new Command();
      cmdProgram.name(role);
      cmdProgram.exitOverride(); // Prevent Commander from exiting the process
      
      if (role === "user") {
        createUserCommands(cmdProgram, env);
      } else if (role === "agent") {
        createAgentCommands(cmdProgram, env);
      } else if (role === "merchant") {
        createMerchantCommands(cmdProgram, env);
      }
      
      // Parse command (role is already implied, so we don't need to include it)
      // Commander expects: [programName, command, ...args]
      await cmdProgram.parseAsync([role, cmdName, ...cmdArgs], { from: "user" });
    } catch (error: any) {
      // Handle Commander.js errors
      if (error.code === "commander.unknownCommand") {
        console.error(chalk.red(`\n❌ Unknown command: ${error.args?.[0] || command.split(/\s+/)[0]}`));
        console.log(chalk.yellow("💡 Type 'help' to see available commands\n"));
      } else if (error.code === "commander.missingArgument") {
        console.error(chalk.red(`\n❌ Missing required argument: ${error.message}`));
        console.log(chalk.yellow("💡 Type 'help' to see command usage\n"));
      } else {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        if (error.logs) {
          console.error(chalk.gray(error.logs.join("\n")));
        }
      }
    }
  }
}

// Handle errors
process.on("unhandledRejection", (error: any) => {
  console.error(chalk.red(`\n❌ Unhandled error: ${error.message}`));
  if (error.stack) {
    console.error(chalk.gray(error.stack));
  }
  process.exit(1);
});

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
    process.exit(1);
  });
}

export { main };

