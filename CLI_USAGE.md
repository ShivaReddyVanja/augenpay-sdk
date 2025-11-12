# AugenPay CLI Usage Guide

The AugenPay CLI is an interactive simulation layer that allows you to test the entire protocol by acting as a User, Agent, or Merchant. All interactions happen on Solana Devnet.

## Table of Contents

- [Complete Testing Workflow](#complete-testing-workflow)
- [Command Reference](#command-reference)
  - [User Commands](#user-commands)
  - [Agent Commands](#agent-commands)
  - [Merchant Commands](#merchant-commands)

---

## Complete Testing Workflow

This section walks you through a complete end-to-end test of the AugenPay protocol using three terminal windows.

**💡 Important Notes for First-Time Users:**
- **Addresses**: When you see output with addresses (like `Mandate: abc123...`), you can copy them, but the CLI remembers the last used addresses automatically
- **Easiest Approach**: Use commands without addresses (e.g., `deposit -a 500` instead of `deposit <address> -a 500`) - the CLI will use the last created/used address
- **Multiple Terminals**: Keep Terminal 1 (User) open while opening Terminal 2 (Agent) and Terminal 3 (Merchant) in separate windows
- **Session**: The CLI saves addresses to `.augenpay-session.json`, so you don't need to copy addresses between commands

### Prerequisites

1. **Generate Wallets** (if not already done):
   ```bash
   yarn generate-keypairs
   ```
   This creates three wallets in `.keypairs/`:
   - `user.json` - User wallet
   - `agent.json` - Agent wallet
   - `merchant.json` - Merchant wallet

2. **Get Wallet Addresses**:
   To see all wallet addresses with funding links:
   ```bash
   yarn show-wallets
   ```
   Or wallet addresses are also shown when you run `yarn cli`.
   
3. **Fund Wallets with SOL**:
   Visit [Solana Faucet](https://faucet.solana.com) and fund each wallet address:
   - User wallet address
   - Agent wallet address
   - Merchant wallet address
   
   Each wallet needs at least 0.5 SOL (recommended) for transactions.

### Step-by-Step Workflow

#### Terminal 1: User Role

1. **Start the CLI as User**:
   ```bash
   yarn cli
   # Select: 👤 User
   ```

2. **Setup Test Tokens** (Optional but recommended):
   ```bash
   setup-tokens
   ```
   This creates a test SPL token and mints 1000 tokens to each wallet (user, agent, merchant).
   
   **Note**: This step is optional. If you skip it, `create-mandate` will create a test token automatically. However, running `setup-tokens` first ensures all wallets have tokens before creating the mandate.

3. **Create a Mandate**:
   ```bash
   create-mandate
   ```
   This will:
   - Use existing test token from session (if `setup-tokens` was run), OR create a new test token
   - Create a mandate with vault
   - Automatically mint 100,000 tokens to each wallet (unless `--no-mint` flag is used)
   
   **Note**: 
   - The mint address is saved to session and reused for all future mandates
   - If you provide `-m <mint-address>` flag, it won't auto-mint tokens (you might not have mint authority)
   - You'll see output like:
   ```
   🧾 Mandate created!
      Owner: <owner-address>
      Mandate: g2FGUeeCnUBqkYstyQNGCQSLgTPD5x9wL8e4DF4dtLU
      Vault: <vault-address>
      Limit: 100 tokens
      Expiry: <date>
      ✅ TX: <transaction-signature>
         🔗 <explorer-link>
   
   💰 Minting 100,000 tokens to each wallet...
   ✅ Tokens minted!
   ```
   
   **Note**: The mandate address is automatically saved to session, so you don't need to copy it for the next steps.

4. **Deposit Tokens into Vault**:
   
   **Option 1** (Easiest - uses session, no address needed):
   ```bash
   deposit -a 500
   ```
   
   **Option 2** (If you want to specify the mandate address explicitly):
   ```bash
   deposit g2FGUeeCnUBqkYstyQNGCQSLgTPD5x9wL8e4DF4dtLU -a 500
   ```
   (You can find the mandate address in the output from step 3, but this is optional - Option 1 is easier)
   
   This deposits 500 tokens from your wallet into the mandate vault.
   
   **💡 Tip**: Since the mandate was just created, you can use `deposit -a 500` (without the address) - it will automatically use the last created mandate.

5. **Create Allotment for Agent**:
   
   **Option 1** (Easiest - uses session, no address needed):
   ```bash
   create-allotment -a 200
   ```
   
   **Option 2** (If you want to specify the mandate address explicitly):
   ```bash
   create-allotment g2FGUeeCnUBqkYstyQNGCQSLgTPD5x9wL8e4DF4dtLU -a 200
   ```
   (You can find the mandate address in the output from step 3, but this is optional - Option 1 is easier)
   
   This creates an allotment allowing the agent to spend up to 200 tokens from the mandate.
   
   **💡 Tip**: Use `create-allotment -a 200` (without address) - it will use the last mandate automatically.
   
   **Note**: The vault must have at least 200 tokens. If you get an "Insufficient funds" error, deposit more tokens first.

#### Terminal 2: Agent Role

1. **Start the CLI as Agent**:
   ```bash
   yarn cli
   # Select: 🤖 Agent
   ```

2. **List Available Allotments**:
   ```bash
   list-allotments
   ```
   You should see the allotment created by the user:
   ```
   ✅ Found 1 valid allotment(s):
   
   1. ⭐ GZHDGxWpPmB8wqyB7YxaLT86u1PmGQC39GwaAoKroGEP
      Status: ACTIVE
      Mandate: g2FGUeeCnUBqkYstyQNGCQSLgTPD5x9wL8e4DF4dtLU (don't use this)
      Allowed: 200.000000 tokens
      Spent: 0.000000 tokens
      Remaining: 200.000000 tokens
   ```
   
   **Note**: The allotment address is automatically saved to session (marked with ⭐), so you don't need to copy it for the next step.

3. **Execute Payment (Redeem)**:
   
   **Option 1** (Easiest - will auto-select if only one allotment exists):
   ```bash
   redeem -t 50
   ```
   
   **Option 2** (If you want to specify the allotment address explicitly):
   ```bash
   redeem GZHDGxWpPmB8wqyB7YxaLT86u1PmGQC39GwaAoKroGEP -t 50
   ```
   (You can find the allotment address in the output from step 2, but this is optional - Option 1 is easier)
   
   **💡 Tip**: If you have only one allotment, just use `redeem -t 50` - it will automatically use it.
   
   **Order ID**: If not provided with `-o` flag, a unique order ID is auto-generated (e.g., `ORD-1762763653859-lch2x5o`).
   
   This will:
   - Auto-generate order ID (or use provided one with `-o` flag)
   - Execute the payment on-chain
   - Create a redemption ticket
   - Transfer 50 tokens from vault to merchant
   
   You'll see output like:
   ```
   Order ID: ORD-1762763653859-lch2x5o (auto-generated)
   Current redemption count: 0
   💳 Executing payment...
      Allotment: <allotment-address>
      Merchant: <merchant-address>
      Amount: 50 tokens
      Order ID: ORD-1762763653859-lch2x5o
   ✅ Payment executed!
      Ticket: <ticket-address>
      Order ID: ORD-1762763653859-lch2x5o
      Amount: 50 tokens
      Context Hash: <hash>
      ✅ TX: <transaction-signature>
         🔗 <explorer-link>
   ```

#### Terminal 3: Merchant Role

1. **Start the CLI as Merchant**:
   ```bash
   yarn cli
   # Select: 🏪 Merchant
   ```

2. **List All Tickets**:
   ```bash
   list
   ```
   You should see the ticket created by the agent:
   ```
   ✅ Found 1 ticket(s):
   
   1. GBaTLLy8rF8pd8Ns4n3qxCAhnFe3Yk77RDgdWGeycuUh (last used)
      Amount: 50 tokens
      Allotment: GZHDGxWpPmB8wqyB7YxaLT86u1PmGQC39GwaAoKroGEP
      Timestamp: <timestamp>
      Context Hash (Order Hash): <hash>
   ```
   
   **Note**: The ticket address is automatically saved to session (marked as "last used"), so you don't need to copy it for verification.

3. **Verify a Ticket**:
   
   **Option 1** (Easiest - will auto-select if only one ticket exists):
   ```bash
   verify
   ```
   
   **Option 2** (If you want to specify the ticket address explicitly):
   ```bash
   verify GBaTLLy8rF8pd8Ns4n3qxCAhnFe3Yk77RDgdWGeycuUh
   ```
   (You can find the ticket address in the output from step 2, but this is optional - Option 1 is easier)
   
   **💡 Tip**: If you have only one ticket, just use `verify` - it will automatically use it.
   
   This verifies the ticket on-chain and shows:
   ```
   ✅ Ticket verified!
   
   📋 Ticket Details:
      Ticket: <ticket-address>
      Merchant: <merchant-address>
      Allotment: <allotment-address>
      Amount: 50 tokens
      Timestamp: <timestamp>
      Context Hash (Order Hash): <hash>
   ```

4. **Find Ticket by Hash** (Optional):
   ```bash
   find -h <order-hash>
   ```

### Testing Pause/Resume Functionality

#### Terminal 1: User Role

1. **Pause a Mandate**:
   
   **Option 1** (Easiest - uses session, no address needed):
   ```bash
   pause
   ```
   
   **Option 2** (If you want to specify the mandate address explicitly):
   ```bash
   pause g2FGUeeCnUBqkYstyQNGCQSLgTPD5x9wL8e4DF4dtLU
   ```
   (You can find the mandate address in the output from Terminal 1, step 3, but this is optional - Option 1 is easier)
   
   Output:
   ```
   ✅ Mandate paused!
   ```

#### Terminal 2: Agent Role

2. **Try to Redeem (Should Fail)**:
   ```bash
   redeem -t 30
   ```
   (Uses the last allotment from session automatically)
   
   You should see a clear error message:
   ```
   ❌ Mandate is paused!
   
   💡 The mandate associated with this allotment has been paused by the user.
   
   💡 Solution:
      1. Ask the user to resume the mandate:
         resume
      2. Then try redeeming again
   ```

#### Terminal 1: User Role

3. **Resume the Mandate**:
   ```bash
   resume
   ```
   (Uses the last mandate from session automatically)
   
   Output:
   ```
   ✅ Mandate resumed!
   ```

#### Terminal 2: Agent Role

4. **Try to Redeem Again (Should Succeed)**:
   ```bash
   redeem -t 30
   ```
   (Uses the last allotment from session automatically)
   
   This should now work successfully!

---

## Command Reference

**Note**: This section shows commands for **direct command mode** (e.g., `yarn cli user create-mandate`). In **interactive mode** (after selecting a role with `yarn cli`), omit the role prefix (e.g., just type `create-mandate`).

### User Commands

Commands for managing mandates, deposits, and allotments.

#### `user setup-tokens`

Create test token and mint tokens to all wallets.

**Options:**
- `-a, --amount <number>` - Amount to mint per wallet (default: 1000 tokens)

**Example:**
```bash
user setup-tokens
user setup-tokens -a 2000
```

**What it does:**
- Creates a new SPL token mint
- Mints tokens to user, agent, and merchant wallets
- Saves mint address to session

---

#### `user create-mandate`

Create a new mandate with vault.

**Options:**
- `-m, --mint <address>` - Token mint address (default: creates new test token or uses session mint)
- `-l, --limit <number>` - Per-transaction limit in tokens (default: 100)
- `-e, --expiry <days>` - Expiry in days (default: 30)
- `--no-mint` - Skip automatic token minting

**Positional Arguments:**
- Positional arguments work in both interactive and direct command mode
- Example: `user deposit <mandate-address> -a 500` (works in both modes)

**Example:**
```bash
user create-mandate
user create-mandate -m <mint-address> -l 200 -e 60
user create-mandate --no-mint
```

**What it does:**
- Creates a new mandate PDA
- Creates associated vault (ATA) for the token mint
- If no mint specified, creates new test token or uses session mint
- Automatically mints 100,000 tokens to each wallet (unless `--no-mint` is used)
- Saves mandate, vault, and mint to session

---

#### `user deposit`

Deposit tokens into mandate vault.

**Options:**
- `-a, --amount <number>` - Amount to deposit in tokens (required if not prompted)
- `-m, --mandate <address>` - Mandate address (uses last if not provided)

**Positional Arguments:**
- Can use: `user deposit <mandate-address> -a <amount>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user deposit <mandate-address> -a 500

# With flag
user deposit --mandate <mandate-address> -a 500

# Uses last mandate from session
user deposit -a 500
```

**What it does:**
- Transfers tokens from user's token account to mandate vault
- Validates user has sufficient balance
- Shows transaction signature

---

#### `user create-allotment`

Create spending allotment for agent.

**Options:**
- `-a, --amount <number>` - Allowed amount in tokens (default: 200)
- `-t, --ttl <hours>` - Time to live in hours (default: 24)
- `-m, --mandate <address>` - Mandate address (uses last if not provided)

**Positional Arguments:**
- Can use: `user create-allotment <mandate-address> -a <amount>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user create-allotment <mandate-address> -a 300

# With flag
user create-allotment --mandate <mandate-address> -a 300 -t 48

# Uses last mandate from session
user create-allotment -a 300
```

**What it does:**
- Creates an allotment authorizing agent to spend from mandate
- Checks vault has sufficient balance
- Sets spending limit and expiry time
- Saves allotment to session

---

#### `user pause`

Pause a mandate (prevents all spending).

**Options:**
- `-m, --mandate <address>` - Mandate address (uses last if not provided)

**Positional Arguments:**
- Can use: `user pause <mandate-address>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user pause <mandate-address>

# With flag
user pause --mandate <mandate-address>

# Uses last mandate from session
user pause
```

**What it does:**
- Pauses the mandate
- All allotments become unusable until resumed

---

#### `user resume`

Resume a paused mandate.

**Options:**
- `-m, --mandate <address>` - Mandate address (uses last if not provided)

**Positional Arguments:**
- Can use: `user resume <mandate-address>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user resume <mandate-address>

# With flag
user resume --mandate <mandate-address>

# Uses last mandate from session
user resume
```

**What it does:**
- Resumes the mandate
- All allotments become usable again

---

#### `user withdraw`

Withdraw tokens from mandate vault.

**Options:**
- `-a, --amount <number>` - Amount to withdraw in tokens (required if not prompted)
- `-m, --mandate <address>` - Mandate address (uses last if not provided)

**Positional Arguments:**
- Can use: `user withdraw <mandate-address> -a <amount>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user withdraw <mandate-address> -a 100

# With flag
user withdraw --mandate <mandate-address> -a 100

# Uses last mandate from session
user withdraw -a 100
```

**What it does:**
- Transfers tokens from vault back to user's token account
- Shows transaction signature

---

#### `user view`

View mandate and allotment information.

**Options:**
- `-m, --mandate <address>` - Mandate address (uses last if not provided, or prompts to select)

**Positional Arguments:**
- Can use: `user view <mandate-address>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
user view <mandate-address>

# With flag
user view --mandate <mandate-address>

# Uses last mandate from session or prompts to select
user view
```

**What it shows:**
- Mandate owner
- Mandate and vault addresses
- Token mint
- Per-transaction limit
- Paused status
- Expiry date
- Current vault balance

---

#### `user list`

List all mandates for this user.

**Example:**
```bash
user list
```

**What it shows:**
- All mandates owned by the user
- Token mint for each
- Vault balance
- Per-transaction limit
- Paused status
- Expiry date

---

### Agent Commands

Commands for executing payments using allotments.

#### `agent list-allotments`

List available allotments for this agent.

**Example:**
```bash
agent list-allotments
```

**What it shows:**
- All allotments assigned to the agent
- Status (ACTIVE, EXPIRED, REVOKED)
- Mandate address
- Allowed amount
- Spent amount
- Remaining balance
- Redemption count
- Expiry timestamp
- Filters out incompatible allotments (from older protocol versions)

---

#### `agent redeem`

Execute payment using an allotment.

**Options:**
- `-a, --allotment <address>` - Allotment address (uses last if not provided, or prompts to select)
- `-m, --merchant <address>` - Merchant address (uses merchant wallet if not provided)
- `-t, --amount <number>` - Payment amount in tokens (required if not prompted)
- `-o, --order-id <id>` - Order ID (auto-generates unique ID if not provided)

**Positional Arguments:**
- Can use: `agent redeem <allotment-address> -t <amount>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
agent redeem <allotment-address> -t 50

# With flag
agent redeem --allotment <allotment-address> -t 50

# Auto-generates order ID
agent redeem -t 50

# With custom order ID
agent redeem -a <allotment-address> -t 50 -o "order-123"
```

**Note**: Order ID is automatically generated if not provided (format: `ORD-<timestamp>-<random>`). You only need `-o` flag if you want a specific order ID.

**What it does:**
- Auto-generates order ID if not provided (or uses provided one with `-o` flag)
- Generates context hash from order data
- Executes payment on-chain
- Transfers tokens from vault to merchant
- Creates redemption ticket
- Updates allotment spent amount
- Increments redemption count
- Shows ticket address and transaction signature

**Note**: If you get an error about incompatible allotment, create a new one using `user create-allotment`.

---

#### `agent proofs`

View a redemption ticket (proof) created by this agent.

**Options:**
- `-t, --ticket <address>` - Ticket address (uses last ticket from session if not provided)

**Example:**
```bash
agent proofs
agent proofs -t <ticket-address>
```

**What it shows:**
- Ticket address
- Allotment address
- Merchant address
- Amount paid
- Timestamp
- Context hash (order hash)

**Note**: This command shows a single ticket. To view a different ticket, use the `-t` flag or execute a new payment to update the session ticket.

---

### Merchant Commands

Commands for verifying payments and listing tickets.

#### `merchant verify`

Verify a payment ticket on-chain.

**Options:**
- `-t, --ticket <address>` - Ticket address (uses last if not provided, or prompts to select)
- `-h, --hash <hex>` - Expected order hash for verification (optional)

**Positional Arguments:**
- Can use: `merchant verify <ticket-address>` (works in both interactive and direct mode)

**Example:**
```bash
# Positional argument (works in both modes)
merchant verify <ticket-address>

# With flag
merchant verify --ticket <ticket-address>

# Uses last ticket from session or prompts to select
merchant verify

# With hash verification
merchant verify <ticket-address> -h <order-hash>
```

**What it does:**
- Fetches ticket data from on-chain
- Verifies ticket belongs to this merchant
- Optionally verifies context hash matches expected order hash
- Displays ticket details
- Saves ticket to session

---

#### `merchant list`

List all payment tickets for this merchant.

**Example:**
```bash
merchant list
```

**What it shows:**
- All tickets received by the merchant
- Ticket address (bold, with note to use for verify)
- Amount paid
- Allotment address
- Timestamp
- Context Hash (Order Hash) - clearly labeled to avoid confusion with transaction hash

---

#### `merchant find`

Find ticket by order hash.

**Options:**
- `-h, --hash <hex>` - Order hash (64 hex characters, 32 bytes) - **Required**

**Example:**
```bash
merchant find -h <order-hash>
```

**What it does:**
- Searches for ticket matching the provided order hash
- Displays ticket details if found
- Shows "No ticket found" if not found

---

## Tips & Best Practices

1. **Session Management**: The CLI saves last-used addresses in `.augenpay-session.json`. Commands will use these automatically, but you can always override with explicit addresses.

2. **Positional Arguments**: Most commands accept addresses as positional arguments for convenience. **Works in both interactive and direct command mode**:
   
   **Interactive mode** (after selecting role):
   - `deposit <mandate-address> -a 500`
   - `redeem <allotment-address> -t 50`
   - `verify <ticket-address>`
   
   **Direct command mode**:
   - `user deposit <mandate-address> -a 500`
   - `agent redeem <allotment-address> -t 50`
   - `merchant verify <ticket-address>`
   
   You can also use flags: `--mandate`, `--allotment`, `--ticket`

3. **Interactive Selection**: If you don't provide an address, many commands will:
   - Use the last-used address from session
   - Or show an interactive menu to select from available options
   
   **Note**: In direct command mode (`yarn cli user deposit ...`), if no address is provided, it will use the session address or show an error.

4. **Order ID Auto-Generation**: The `redeem` command (interactive mode) or `agent redeem` command (direct mode) automatically generates a unique order ID if not provided:
   - Format: `ORD-<timestamp>-<random>`
   - Example: `ORD-1762763653859-lch2x5o`
   - Use `-o` flag only if you need a specific order ID

5. **Error Messages**: The CLI provides helpful error messages with solutions:
   - Insufficient funds → Shows how to deposit
   - Incompatible allotment → Explains how to create new one
   - Mint mismatch → Shows which mint to use
   - Mandate paused → Clear message with resume instructions

6. **Multi-Terminal Testing**: Use three terminals for realistic testing:
   - Terminal 1: User (creates mandates, deposits, creates allotments)
   - Terminal 2: Agent (lists allotments, executes payments)
   - Terminal 3: Merchant (verifies tickets, lists payments)

7. **Transaction Links**: All transaction signatures include Solana Explorer links for easy verification.

8. **Context Hash vs Transaction Hash**: 
   - **Context Hash (Order Hash)**: SHA256 hash of order data, used for payment verification
   - **Transaction Hash**: Solana transaction signature, used for blockchain verification
   - The CLI clearly labels these to avoid confusion

---

## Troubleshooting

### "Insufficient SOL balance"
- Fund wallets at [Solana Faucet](https://faucet.solana.com)
- Each wallet needs at least 0.5 SOL (recommended)

### "Insufficient funds in mandate vault"
- Deposit tokens into the vault first: `deposit -a <amount>` (interactive) or `user deposit -a <amount>` (direct)
- Check vault balance: `view` (interactive) or `user view` (direct)

### "Allotment incompatible with current protocol"
- The allotment was created with an older protocol version
- Create a new allotment: `create-allotment` (interactive) or `user create-allotment` (direct)

### "Invalid account discriminator" or "Account does not exist"
- The address doesn't exist on-chain or is wrong account type
- Use `list` commands to see valid addresses
- Make sure you're using the correct address type (mandate vs allotment vs ticket)

### "Mandate is paused"
- Resume the mandate: `resume` (interactive) or `user resume` (direct)

### Mint mismatch errors
- Make sure mandate and tokens use the same mint
- Create mandate with test token: `create-mandate` (interactive) or `user create-mandate` (direct) - auto-creates test token
- Or use existing mint: `create-mandate -m <mint-address>` (interactive) or `user create-mandate -m <mint-address>` (direct)

