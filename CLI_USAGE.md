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

### Prerequisites

1. **Generate Wallets** (if not already done):
   ```bash
   yarn generate-keypairs
   ```
   This creates three wallets in `.keypairs/`:
   - `user.json` - User wallet
   - `agent.json` - Agent wallet
   - `merchant.json` - Merchant wallet

2. **Fund Wallets with SOL**:
   Visit [Solana Faucet](https://faucet.solana.com) and fund each wallet address:
   - User wallet address (shown when you run `yarn cli`)
   - Agent wallet address
   - Merchant wallet address
   
   Each wallet needs at least 0.5(recommended) SOL for transactions.

### Step-by-Step Workflow

#### Terminal 1: User Role

1. **Start the CLI as User**:
   ```bash
   yarn cli
   # Select: 👤 User
   ```

2. **Setup Test Tokens**:
   ```bash
   user setup-tokens
   ```
   This creates a test SPL token and mints 1000 tokens to each wallet (user, agent, merchant).

3. **Create a Mandate**:
   ```bash
   user create-mandate
   ```
   This will:
   - Create a new test token (if no session mint exists)
   - Create a mandate with vault
   - Automatically mint 100,000 tokens to each wallet
   
   **Note**: The mint address is saved to session. You'll see output like:
   ```
   🧾 Mandate created!
      Mandate: <mandate-address>
      Vault: <vault-address>
   ```

4. **Deposit Tokens into Vault**:
   ```bash
   user deposit <mandate-address> -a 500
   ```
   Or with flag:
   ```bash
   user deposit --mandate <mandate-address> -a 500
   ```
   Or simply (uses last mandate from session):
   ```bash
   user deposit -a 500
   ```
   
   This deposits 500 tokens from your wallet into the mandate vault.
   
   **Note**: Positional arguments work in both interactive and direct command mode.

5. **Create Allotment for Agent**:
   ```bash
   user create-allotment <mandate-address> -a 200
   ```
   Or with flag:
   ```bash
   user create-allotment --mandate <mandate-address> -a 200
   ```
   Or (uses last mandate from session):
   ```bash
   user create-allotment -a 200
   ```
   
   This creates an allotment allowing the agent to spend up to 200 tokens from the mandate.
   
   **Note**: The vault must have at least 200 tokens. If you get an "Insufficient funds" error, deposit more tokens first.

#### Terminal 2: Agent Role

1. **Start the CLI as Agent**:
   ```bash
   yarn cli
   # Select: 🤖 Agent
   ```

2. **List Available Allotments**:
   ```bash
   agent list-allotments
   ```
   You should see the allotment created by the user:
   ```
   ✅ Found 1 valid allotment(s):
   
   1. <allotment-address> ← Use this address for redeem!
      Status: ACTIVE
      Mandate: <mandate-address>
      Allowed: 200.000000 tokens
      Spent: 0.000000 tokens
      Remaining: 200.000000 tokens
   ```

3. **Execute Payment (Redeem)**:
   ```bash
   agent redeem <allotment-address> -t 50
   ```
   Or with flag:
   ```bash
   agent redeem --allotment <allotment-address> -t 50
   ```
   Or (will prompt to select allotment if multiple exist):
   ```bash
   agent redeem -t 50
   ```
   
   **Order ID**: If not provided with `-o` flag, a unique order ID is auto-generated (e.g., `ORD-1762763653859-lch2x5o`).
   
   This will:
   - Auto-generate order ID (or use provided one with `-o` flag)
   - Execute the payment on-chain
   - Create a redemption ticket
   - Transfer 50 tokens from vault to merchant
   
   You'll see output like:
   ```
   Order ID: ORD-1762763653859-lch2x5o (auto-generated)
   ✅ Payment executed!
      Ticket: <ticket-address>
      Amount: 50 tokens
      TX: <transaction-signature>
   ```

#### Terminal 3: Merchant Role

1. **Start the CLI as Merchant**:
   ```bash
   yarn cli
   # Select: 🏪 Merchant
   ```

2. **List All Tickets**:
   ```bash
   merchant list
   ```
   You should see the ticket created by the agent:
   ```
   ✅ Found 1 ticket(s):
   
   1. <ticket-address> ← Use this for verify!
      Amount: 50 tokens
      Allotment: <allotment-address>
      Timestamp: <timestamp>
      Context Hash (Order Hash): <hash>
   ```

3. **Verify a Ticket**:
   ```bash
   merchant verify <ticket-address>
   ```
   Or with flag:
   ```bash
   merchant verify --ticket <ticket-address>
   ```
   Or (will prompt to select ticket if multiple exist):
   ```bash
   merchant verify
   ```
   
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
   merchant find -h <order-hash>
   ```

### Testing Pause/Resume Functionality

#### Terminal 1: User Role

1. **Pause a Mandate**:
   ```bash
   user pause <mandate-address>
   ```
   Or:
   ```bash
   user pause
   ```
   (Uses last mandate from session)
   
   Output:
   ```
   ✅ Mandate paused!
   ```

#### Terminal 2: Agent Role

2. **Try to Redeem (Should Fail)**:
   ```bash
   agent redeem <allotment-address> -t 30
   ```
   
   You should see a clear error message:
   ```
   ❌ Mandate is paused!
   
   💡 The mandate associated with this allotment has been paused by the user.
   
   💡 Solution:
      1. Ask the user to resume the mandate:
         user resume <mandate-address>
      2. Then try redeeming again
   ```

#### Terminal 1: User Role

3. **Resume the Mandate**:
   ```bash
   user resume <mandate-address>
   ```
   
   Output:
   ```
   ✅ Mandate resumed!
   ```

#### Terminal 2: Agent Role

4. **Try to Redeem Again (Should Succeed)**:
   ```bash
   agent redeem <allotment-address> -t 30
   ```
   
   This should now work successfully!

---

## Command Reference

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

List redemption tickets (proofs) created by this agent.

**Example:**
```bash
agent proofs
```

**What it shows:**
- All redemption tickets created by the agent
- Ticket address
- Merchant address
- Amount paid
- Timestamp
- Context hash (order hash)

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
   - `user deposit <mandate-address> -a 500`
   - `agent redeem <allotment-address> -t 50`
   - `merchant verify <ticket-address>`
   
   You can also use flags: `--mandate`, `--allotment`, `--ticket`

3. **Interactive Selection**: If you don't provide an address, many commands will:
   - Use the last-used address from session
   - Or show an interactive menu to select from available options
   
   **Note**: In direct command mode (`yarn cli user deposit ...`), if no address is provided, it will use the session address or show an error.

4. **Order ID Auto-Generation**: The `agent redeem` command automatically generates a unique order ID if not provided:
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
- Each wallet needs at least 0.1 SOL

### "Insufficient funds in mandate vault"
- Deposit tokens into the vault first: `user deposit -a <amount>`
- Check vault balance: `user view`

### "Allotment incompatible with current protocol"
- The allotment was created with an older protocol version
- Create a new allotment: `user create-allotment`

### "Invalid account discriminator" or "Account does not exist"
- The address doesn't exist on-chain or is wrong account type
- Use `list` commands to see valid addresses
- Make sure you're using the correct address type (mandate vs allotment vs ticket)

### "Mandate is paused"
- Resume the mandate: `user resume`

### Mint mismatch errors
- Make sure mandate and tokens use the same mint
- Create mandate with test token: `user create-mandate` (auto-creates test token)
- Or use existing mint: `user create-mandate -m <mint-address>`

