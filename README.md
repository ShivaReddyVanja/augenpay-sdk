# AugenPay SDK

TypeScript SDK for interacting with the AugenPay Payment Protocol on Solana.

## Introduction

**AugenPay** lets you safely give AI agents or automated services permission to make payments on your behalf, with built-in limits and controls.

**How it works:**
- You create a **mandate** (like a payment wallet) and set spending limits
- You give **allotments** to agents (permission to spend up to a certain amount)
- Agents can **redeem** allotments to pay merchants
- Merchants get **on-chain proof** that payment was received

**Why it's useful:**
- ✅ Set spending limits so agents can't overspend
- ✅ Revoke permissions anytime
- ✅ Merchants can verify payments on the blockchain
- ✅ Support for multiple small payments (micropayments)

> 📖 **New to AugenPay?** Check out [TERMINOLOGY.md](./TERMINOLOGY.md) for explanations of terms like mandate, allotment, redemption, PDA, and more.

### Core Strengths

**Infra Layer + SDK + x402-compatible Trust Engine**

AugenPay delivers three critical components:

- **Infrastructure Layer**: On-chain Solana program providing the trustless foundation for delegated payments
- **Full SDK**: Complete TypeScript SDK enabling seamless integration for developers
- **x402-compatible Trust Engine**: Enables x402-compliant payments with blockchain-verified payment proofs


### Protocol & SDK Details

- **Protocol**: AugenPay Payment Protocol deployed on Solana
- **Program ID**: `6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp`
- **Network**: Solana Devnet
- **Explorer**: [https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet](https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet)
- **Protocol Repository**: [https://github.com/ShivaReddyVanja/augenpay-protocol.git](https://github.com/ShivaReddyVanja/augenpay-protocol.git)

## Current Problem

⚙️ **The Core Problem**

Today's AI agents can make decisions and take actions, but they can't make payments safely.

### 1️⃣ Users must share private keys (Not Safe!)

To let an agent make payments, users currently have to give the agent their **private keys** or full wallet access.

**This is dangerous because:**
- The agent can drain your entire wallet
- No spending limits - agent can overspend
- Can't revoke access without changing your wallet
- One bug or hack = all your funds gone

**Example:** You want an agent to buy a $10 coffee, but you have to give it access to your entire wallet with $1000. Not safe!

### 2️⃣ Merchants can't verify payments

When an agent says "I paid," merchants can't verify it on the blockchain.

They have to trust:
- API responses
- Off-chain receipts
- Third-party payment services

There's no way to cryptographically prove the payment actually happened.

### 3️⃣ No standard payment protocol

There's no standard way for agents and merchants to handle payments automatically.

This means:
- Manual payment processes
- No trustless payment verification
- Difficult to build autonomous commerce

## Solution

**AugenPay** solves these problems by providing:

### Core Features

- ✅ **Mandate System**: Users create payment mandates with configurable limits and expiration
- ✅ **Agent Delegation**: Create spending allotments for agents with time-bound, amount-limited access
- ✅ **On-Chain Verification**: All payments are recorded on-chain with order data hashing
- ✅ **Merchant Discovery**: Merchants can query and verify all payment tickets independently
- ✅ **Security Controls**: Pause/resume mandates, set per-transaction limits, expiration controls
- ✅ **x402 Payment Gating**: HTTP 402 Payment Required with on-chain payment proof verification
- ✅ **Payment Middleware**: Gate API endpoints behind payment proof verification

### How It Works

1. **User Setup**: User creates a mandate, deposits funds, and creates spending allotments for agents
2. **Agent Payment**: Agent executes payments on-chain via `redeem()`, creating verifiable payment tickets
3. **Merchant Verification**: Merchant verifies payment proofs on-chain within seconds, unlocking API access
4. **x402 Flow**: Merchant responds with HTTP 402, agent pays, submits proof, merchant verifies and grants access

This provides **granular control**, **on-chain transparency**, and **instant verification** - solving both the AI agent payment problem and the x402 micro-payment verification challenge.

## Demo

### Prerequisites

Before installing the SDK, make sure you have:

- **Node.js** (v16.0.0 or higher)
- **npm** or **yarn** package manager
- **TypeScript** (installed globally or as dev dependency)

> 💡 **Note:** All commands work with both `npm` and `yarn`. You can use either package manager - just replace `yarn` with `npm run` in the examples below.

### Clone the Repository

```bash
git clone https://github.com/ShivaReddyVanja/augenpay-sdk.git
cd augenpay-sdk
```

1. **Install Dependencies**:

**Using yarn:**
```bash
yarn install
```
**Using npm:**
```bash
npm install
```

2. **Generate Keypairs** (if not already done):
   
   **Using yarn:**
   ```bash
   yarn generate-keypairs
   ```
   
   **Using npm:**
   ```bash
   npm run generate-keypairs
   ```
   
   This creates `.keypairs/` directory with:
   - `user.json` - User wallet
   - `agent.json` - Agent wallet  
   - `merchant.json` - Merchant wallet

3. **Fund the Wallets**:
   - Visit https://faucet.solana.com
   - Fund each wallet (minimum 0.5 SOL recommended)
   - Or use: `yarn show-wallets` or `npm run show-wallets` to get wallet links

### Running the Sandbox Demo

The sandbox demonstrates the complete **x402 Payment Challenge** flow:

```bash
yarn sandbox
```

```bash
# Using npm
npm run sandbox

#### What the Sandbox Demonstrates

1. **Setup Phase**
   - User creates mandate and deposits funds
   - User creates spending allotment for agent

2. **x402 Payment Challenge Flow**
   - Agent posts order request to merchant API
   - Merchant responds with `HTTP 402 Payment Required` + payment data
   - Agent executes payment on blockchain via `redeem()`
   - Agent submits payment proof (ticket/hash) to merchant API
   - Merchant middleware verifies proof on-chain and unlocks API access
   - Merchant fulfills the order

3. **Verification Phase**
   - On-chain ticket verification
   - Merchant queries all tickets
   - Additional features demo (pause/resume, withdrawals)

#### Expected Output

You'll see detailed console output showing:
- 🔑 Keypair loading and wallet addresses
- 💰 Balance checks and token setup
- 📝 Mandate creation and configuration
- 🎫 Allotment creation for agent
- 🤖 Agent → Merchant API communication
- 🏪 HTTP 402 Payment Required response
- 🔒 API gating demonstration (access denied before payment)
- ⛓️ On-chain payment execution
- 🔐 Payment proof submission and verification
- 🔓 API unlock after verification
- ✅ Order fulfillment

#### Troubleshooting

**Insufficient SOL balance:**
```
❌ Insufficient SOL balance!
💰 Please fund wallets at: https://faucet.solana.com
```
→ Fund the wallets using the provided links

**Keypair not found:**
```
❌ Keypair not found: user.json
🔑 Please generate keypairs first: yarn generate-keypairs
```
→ Run `yarn generate-keypairs` first

## Interactive CLI

The AugenPay SDK includes a powerful interactive CLI that lets you test the entire protocol by acting as a User, Agent, or Merchant. This is perfect for:

- **Judges & Evaluators**: Explore the protocol without writing code
- **Developers**: Test integrations and understand the flow
- **Demonstrations**: Show the protocol in action

### Quick Start

```bash
# Generate wallets (if not already done)
yarn generate-keypairs

# Start the CLI
yarn cli
```

The CLI will prompt you to select a role (User, Agent, or Merchant) and then provide an interactive command interface.

### Complete Testing Workflow

For a complete end-to-end testing guide with step-by-step instructions, see **[CLI_USAGE.md](./CLI_USAGE.md)**.

The guide includes:
- Complete workflow example using 3 terminals
- Testing pause/resume functionality
- Full command reference with all options
- Troubleshooting tips

### Key Features

- **Role-based Commands**: Separate commands for User, Agent, and Merchant roles
- **Interactive Selection**: Choose from available mandates, allotments, or tickets
- **Session Management**: Automatically remembers last-used addresses
- **Positional Arguments**: Use addresses directly: `user deposit <mandate-address> -a 500`
- **Helpful Error Messages**: Clear errors with solutions
- **Transaction Links**: All transactions include Solana Explorer links

## x402 Payment Challenge Flow Diagram

The following diagram illustrates the complete x402 Payment Challenge flow:

```
┌─────────┐                    ┌──────────┐                    ┌──────────┐
│  Agent  │                    │ Merchant │                    │ Protocol │
│         │                    │   API    │                    │ (Solana) │
└────┬────┘                    └────┬─────┘                    └────┬─────┘
     │                              │                                │
     │ 1. POST /order               │                                │
     │─────────────────────────────>│                                │
     │                              │                                │
     │ 2. HTTP 402 Payment        │                                │
     │    Required + payment data   │                                │
     │<─────────────────────────────│                                │
     │                              │                                │
     │ 3. Execute redeem()          │                                │
     │──────────────────────────────────────────────────────────────>│
     │                              │                                │
     │ 4. Payment proof (ticket)    │                                │
     │─────────────────────────────>│                                │
     │                              │ 5. Verify on-chain             │
     │                              │────────────────────────────────>│
     │                              │                                │
     │                              │ 6. Verification result        │
     │                              │<────────────────────────────────│
     │                              │                                │
     │ 7. API Access Granted        │                                │
     │<─────────────────────────────│                                │
     │                              │                                │
```

### Step-by-Step Explanation

1. **Agent Requests Service**: Agent sends order request to merchant API (e.g., `POST /order`)

2. **Merchant Responds with 402**: Merchant generates order hash and returns `HTTP 402 Payment Required` with payment data. API endpoint is now **gated** - access denied until payment proof submitted.

3. **Agent Executes Payment**: Agent calls `redeem()` on AugenPay protocol. Payment executes on-chain, creating a redemption ticket with order hash.

4. **Agent Submits Payment Proof**: Agent sends payment proof to merchant API (e.g., `POST /submit-proof`) containing ticket PDA and/or order hash.

5. **Merchant Verifies On-Chain**: Merchant middleware verifies:
   - Ticket exists on-chain
   - Ticket belongs to merchant
   - Order hash matches
   - Payment amount matches
   If valid: order status updated to "paid", API unlocked.

6. **API Access Granted**: Payment gate middleware allows access, merchant fulfills the order.

## Examples

### Basic Usage (Client Class)

```typescript
import { AugenPayClient, AUGENPAY_PROGRAM_ID } from "augenpay-sdk";
import { Keypair, PublicKey } from "@solana/web3.js";

// Initialize client
const client = new AugenPayClient(userKeypair, "devnet", AUGENPAY_PROGRAM_ID);

// Create mandate
const { mandate, vault } = await client.createMandate(
  userKeypair.publicKey,
  mintPublicKey,
  {
    perTxLimit: 100_000000, // 100 tokens
    expiryDays: 30
  }
);

// Deposit funds
await client.deposit(
  mandate,
  userTokenAccount,
  vault,
  mint,
  userKeypair.publicKey,
  500_000000 // 500 tokens
);

// Create allotment for agent
const { allotment } = await client.createAllotment(
  mandate,
  agentPublicKey,
  userKeypair.publicKey,
  {
    allowedAmount: 200_000000,
    ttlHours: 24
  }
);

// Agent executes payment
const orderData = {
  orderId: "ORD-12345",
  customerEmail: "user@example.com",
  items: [{ productId: "PROD-1", quantity: 2, price: 10_000000 }],
  totalAmount: 20_000000,
  timestamp: Date.now(),
};

const { ticket } = await client.redeem({
  allotment,
  mandate,
  agent: agentKeypair.publicKey,
  merchant: merchantPublicKey,
  merchantTokenAccount,
  vault,
  mint,
  amount: 20_000000,
  orderData
});

// Merchant verifies payment
const { valid } = await client.verifyTicket(ticket, orderData);
```

### x402 Merchant API Server

A complete HTTP server example demonstrating x402 payment gating:

```bash
ts-node examples/06-x402-merchant-api.ts
```

The server provides:
- `POST /order` - Create order, returns 402 Payment Required
- `POST /submit-proof` - Submit payment proof, verifies on-chain
- `GET /order/:orderId` - Get order status
- `GET /orders` - List all orders
- `POST /fulfill/:orderId` - Fulfill order

Test with curl:
```bash
# Create order (returns 402)
curl -X POST http://localhost:3000/order \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "movieName": "Batman: The Dark Knight",
    "numberOfTickets": 2,
    "showtime": "7:00 PM"
  }'

# Submit payment proof (after executing redeem)
curl -X POST http://localhost:3000/submit-proof \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORD-1234567890",
    "ticket": "ticket_pda_base58_string",
    "orderHash": "hex_hash_string"
  }'

# Check order status
curl http://localhost:3000/order/ORD-1234567890
```

### Payment Gate Middleware

```typescript
import {
  createPaymentChallenge,
  verifyPaymentProof,
  paymentGateMiddleware,
  PaymentProof
} from "augenpay-sdk";

// 1. Create payment challenge when order is requested
const paymentChallenge = createPaymentChallenge(
  orderId,
  orderData,
  amount,
  merchantPublicKey,
  merchantTokenAccount
);
// Return HTTP 402 with paymentChallenge

// 2. Verify payment proof when agent submits it
const verification = await verifyPaymentProof(
  program,
  orderId,
  {
    ticket: ticketPDA.toBase58(),
    orderHash: hashHex
  }
);

if (verification.valid) {
  // Unlock API access
}

// 3. Gate your endpoints
const gateCheck = paymentGateMiddleware(program, orderId);
if (!gateCheck.allowed) {
  return { status: 402, error: "Payment required" };
}
```

### Merchant Integration

```typescript
// Real-time monitoring
const interval = await merchantService.monitorMerchantTickets(
  program,
  merchantPublicKey,
  5, // check every 5 seconds
  (newTickets) => {
    console.log(`Received ${newTickets.length} payment(s)`);
    newTickets.forEach(async (ticket) => {
      // Verify and fulfill order
      const { valid } = await merchantService.verifyTicket(
  program,
        ticket.pubkey,
  expectedOrderData
);

      if (valid) {
        await fulfillOrder(ticket.account);
      }
    });
  }
);

// Stop when done
merchantService.stopMonitoring(interval);
```

## API Reference

### Client Class (Recommended)

The `AugenPayClient` class provides a unified, object-oriented API:

```typescript
const client = new AugenPayClient(keypair, 'devnet', AUGENPAY_PROGRAM_ID);

// Mandate operations
await client.createMandate(owner, mint, config);
await client.deposit(mandate, from, vault, mint, owner, amount);
await client.withdraw(mandate, vault, to, mint, owner, amount);
await client.pauseMandate(mandate, owner);
await client.resumeMandate(mandate, owner);
const mandate = await client.getMandate(mandateAddress);

// Allotment operations
await client.createAllotment(mandate, agent, owner, config);
await client.modifyAllotment(mandate, allotment, owner, amount, ttl);
await client.revokeAllotment(mandate, allotment, owner);
const allotment = await client.getAllotment(allotmentAddress);

// Payment operations
await client.redeem(params);
client.onRedeem(callback);

// Merchant operations
await client.getTicket(ticket);
await client.getMerchantTickets(merchant);
await client.verifyTicket(ticket, orderData);
await client.findTicketByHash(merchant, hash);
```

### Service-Oriented API

```typescript
import {
  initializeClient,
  mandateService,
  allotmentService,
  redeemService,
  merchantService,
  AUGENPAY_PROGRAM_ID
} from "augenpay-sdk";

// Initialize
const { program } = initializeClient(
  userKeypair,
  "devnet",
  AUGENPAY_PROGRAM_ID
);

// Create mandate
const { mandate, vault } = await mandateService.createMandate(
  program,
  userKeypair.publicKey,
  mintPublicKey,
  {
    perTxLimit: 100_000000,
    expiryDays: 30
  }
);
```

See [examples/00-client-example.ts](./examples/00-client-example.ts) for complete examples.

## Project Structure

```
client/
├── config/
│   └── constants.ts       # Program ID, cluster config
├── core/
│   ├── connection.ts      # Solana connection setup
│   ├── pda.ts             # PDA derivation
│   └── wallet.ts          # Keypair management
├── services/
│   ├── mandate.ts         # Mandate operations
│   ├── allotment.ts       # Allotment operations
│   ├── redeem.ts          # Payment execution
│   └── merchant.ts        # Merchant verification
├── utils/
│   ├── tokens.ts          # Token utilities
│   ├── hashing.ts         # Context hash utilities
│   └── payment-gate.ts    # x402 payment gating utilities
├── sandbox.ts             # Complete x402 demo
├── examples/
│   └── 06-x402-merchant-api.ts  # HTTP server example
└── index.ts               # SDK exports
```

## Configuration

Edit `config/constants.ts`:

```typescript
export const AUGENPAY_PROGRAM_ID = new PublicKey(
  "6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp"
);

export const DEFAULT_CLUSTER = "devnet"; // or "mainnet"
```

## Development

```bash
# Build TypeScript
yarn build

# Run sandbox
yarn dev

# Clean build
yarn clean
```

## Network Configuration

### Devnet (Default)
```typescript
const { program } = await initializeClient(
  keypair,
  "devnet",
  AUGENPAY_PROGRAM_ID
);
```

### Mainnet
```typescript
const { program } = await initializeClient(
  keypair,
  "mainnet",
  AUGENPAY_PROGRAM_ID
);
```

### Localnet
```typescript
const { program } = await initializeClient(
  keypair,
  "localnet",
  AUGENPAY_PROGRAM_ID
);
```

## Security Notes

1. **Never expose private keys** - Use secure key management
2. **Validate all inputs** - Especially amounts and addresses
3. **Verify order data** - Always check hash matches before fulfilling
4. **Set reasonable limits** - Use per-tx and allotment limits
5. **Monitor mandates** - Watch for suspicious activity

## Support

- Program ID: `6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp`
- Network: Solana Devnet
- Explorer: https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet
- Protocol Repository: https://github.com/ShivaReddyVanja/augenpay-protocol.git

## License

MIT
