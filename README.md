# AugenPay SDK

TypeScript SDK for interacting with the AugenPay Payment Protocol on Solana.

## Overview

AugenPay enables **delegated payments with on-chain verification**. Users can authorize agents to make payments on their behalf, and merchants can independently verify payments using on-chain data.

This SDK works with the **AugenPay protocol deployed on Solana Devnet**. You can view the program on-chain:

🔗 **Devnet Explorer**: [https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet](https://explorer.solana.com/address/6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp?cluster=devnet)

**Program ID**: `6RAnxyQmKfsKxDfpFu2Axry4Hah7aFM8zb2oS3oG41qp`

📦 **Protocol Repository**: [https://github.com/ShivaReddyVanja/augenpay-protocol.git](https://github.com/ShivaReddyVanja/augenpay-protocol.git)

## Features

- ✅ **Mandate Management** - Create and manage payment mandates with vaults
- ✅ **Agent Delegation** - Create spending allotments for agents
- ✅ **Payment Execution** - Agents redeem allotments to pay merchants
- ✅ **Hash Verification** - Order data hashed and stored on-chain
- ✅ **Merchant Discovery** - Merchants can query all their payment tickets
- ✅ **Security Controls** - Pause/resume, limits, expiration
- ✅ **x402 Payment Challenge** - HTTP 402-style payment gating with on-chain verification
- ✅ **Payment Middleware** - Gate API endpoints behind payment proof verification

## Installation

```bash
cd client
yarn install
```

## Quick Start

### Run the Sandbox Demo (x402 Payment Challenge)

The sandbox demonstrates the complete **x402 Payment Challenge** flow - a real-world implementation where merchant APIs are gated behind on-chain payment verification.

#### Prerequisites

1. **Generate keypairs** (if not already done):
   ```bash
   yarn generate-keypairs
   ```
   This creates `.keypairs/` directory with:
   - `user.json` - User wallet
   - `agent.json` - Agent wallet  
   - `merchant.json` - Merchant wallet

2. **Fund the wallets** with SOL:
   - Visit https://faucet.solana.com
   - Fund each wallet (minimum 0.5 SOL recommended)
   - Or use the wallet links shown by `yarn show-wallets`

#### Running the Sandbox

```bash
yarn sandbox
```

#### What the Sandbox Demonstrates

The sandbox walks through the complete **x402 Payment Challenge** flow:

1. **Setup Phase**
   - User creates mandate and deposits funds
   - User creates spending allotment for agent

2. **x402 Payment Challenge Flow**
   - **Step 4**: Agent posts order request to merchant API
   - **Step 5**: Merchant responds with `HTTP 402 Payment Required` + payment data
   - **Step 6**: Agent executes payment on blockchain via `redeem()`
   - **Step 7**: Agent submits payment proof (ticket/hash) to merchant API
   - **Step 8**: Merchant middleware verifies proof on-chain and unlocks API access
   - **Step 9**: Merchant fulfills the order

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

### Basic Usage

#### Option 1: Client Class (Recommended for Simplicity)

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

#### Option 2: Service-Oriented API (More Flexible)

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

// ... (same pattern for other operations)
```

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

## x402 Payment Challenge Mechanism

The **x402 Payment Challenge** implements HTTP 402 Payment Required semantics using on-chain payment verification. This allows merchants to gate API access behind verified blockchain payments.

### How It Works

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

### Step-by-Step Flow

1. **Agent Requests Service**
   - Agent sends order request to merchant API (e.g., `POST /order`)
   - Order contains: email, product details, quantity, etc.

2. **Merchant Responds with 402**
   - Merchant generates order hash from order data
   - Returns `HTTP 402 Payment Required` with:
     ```json
     {
       "status": 402,
       "paymentRequired": true,
       "paymentData": {
         "amount": 20000000,
         "merchant": "merchant_pubkey",
         "merchantTokenAccount": "token_account",
         "orderHash": "hex_hash",
         "orderData": { ... }
       }
     }
     ```
   - API endpoint is now **gated** - access denied until payment proof submitted

3. **Agent Executes Payment**
   - Agent calls `redeem()` on AugenPay protocol with payment data
   - Payment executes on-chain, creating a redemption ticket
   - Ticket PDA contains the order hash

4. **Agent Submits Payment Proof**
   - Agent sends payment proof to merchant API (e.g., `POST /submit-proof`)
   - Proof contains: `ticket` (PDA) and/or `orderHash`

5. **Merchant Verifies On-Chain**
   - Merchant middleware calls `verifyPaymentProof()`
   - Verifies:
     - Ticket exists on-chain
     - Ticket belongs to merchant
     - Order hash matches
     - Payment amount matches
   - If valid: order status updated to "paid", API unlocked

6. **API Access Granted**
   - Payment gate middleware now allows access
   - Merchant fulfills the order

### Payment Gate Middleware

The SDK provides middleware utilities to gate your API endpoints:

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

### Benefits

- ✅ **Standard HTTP Semantics** - Uses HTTP 402 status code
- ✅ **On-Chain Verification** - Payment proof verified on blockchain
- ✅ **No Trust Required** - Merchant can independently verify payments
- ✅ **Flexible Integration** - Works with any API framework
- ✅ **Secure** - Payment must be on-chain before API access granted

## Payment Flow

### 1. User Setup
```typescript
// Create mandate
const { mandate, vault } = await mandateService.createMandate(...);

// Deposit funds
await mandateService.depositToMandate(...);

// Create agent allotment
const { allotment } = await allotmentService.createAllotment(...);
```

### 2. Agent Payment
```typescript
// Agent submits order to merchant
// Merchant returns: { paymentAddress, orderHash, amount }

// Agent executes payment
const { ticket } = await redeemService.redeemAllotment(
  program,
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount,
    orderData // Will be hashed
  }
);
```

### 3. Merchant Verification
```typescript
// Option 1: Direct ticket verification
const { valid, ticketData } = await merchantService.verifyTicket(
  program,
  ticketPDA,
  expectedOrderData
);

// Option 2: Query all merchant tickets
const tickets = await merchantService.fetchMerchantTickets(
  program,
  merchantPublicKey
);

// Option 3: Find by hash
const ticket = await merchantService.findTicketByHash(
  program,
  merchantPublicKey,
  targetHash
);
```

## Order Hashing

Orders are hashed using SHA256 before being stored on-chain. You define your own order data structure:

```typescript
import { createContextHashArray, hashToHex, OrderData } from "@augenpay/sdk";

// Define your order data structure (merchant-defined)
const orderData: OrderData = {
  orderId: "ORD-12345",
  customerEmail: "user@example.com",
  items: [
    { productId: "PROD-001", quantity: 2, price: 50 }
  ],
  totalAmount: 100,
  timestamp: Date.now()
};

// Create hash for on-chain storage
const hash = createContextHashArray(orderData);
const hashHex = hashToHex(hash);

// hash = [array of 32 bytes] - use this in redeem()
// hashHex = "7a8b9c..." (hex string for display)
```

Custom order types:

```typescript
import { createContextHashArray } from "./utils/hashing";

const orderData = {
  orderId: "ORD-12345",
  items: [...],
  total: 100,
  // any custom fields
};

const hash = createContextHashArray(orderData);
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

See [examples/00-client-example.ts](./examples/00-client-example.ts) for a complete example.

### Mandate Service

```typescript
// Create mandate
createMandate(program, owner, mint, config)

// Deposit funds
depositToMandate(program, mandate, from, vault, mint, owner, amount)

// Withdraw funds
withdrawFromMandate(program, mandate, vault, to, mint, owner, amount)

// Pause/resume
pauseMandate(program, mandate, owner)
resumeMandate(program, mandate, owner)

// Fetch data
fetchMandate(program, mandate)
displayMandateInfo(mandateData)
```

### Allotment Service

```typescript
// Create allotment
createAllotment(program, mandate, agent, owner, config)

// Modify allotment
modifyAllotment(program, mandate, allotment, owner, newAmount, newTtl)

// Revoke allotment
revokeAllotment(program, mandate, allotment, owner)

// Fetch data
fetchAllotment(program, allotment)
displayAllotmentInfo(allotmentData)
```

### Redeem Service

```typescript
// Execute payment (generic - works for any use case)
redeemAllotment(program, params)

// Event listening
listenForRedeemEvents(program, callback)
removeRedeemListener(program, listenerId)
```

### Merchant Service

```typescript
// Fetch tickets
fetchTicket(program, ticket)
fetchMerchantTickets(program, merchant)

// Verify ticket
verifyTicket(program, ticket, expectedOrderData)

// Search
findTicketByHash(program, merchant, targetHash)

// Monitor
monitorMerchantTickets(program, merchant, intervalSeconds, callback)
stopMonitoring(interval)

// Display
displayTicketInfo(ticketData)
displayMerchantTickets(tickets)
```

### Payment Gate Utilities (x402)

```typescript
import {
  createPaymentChallenge,
  verifyPaymentProof,
  paymentGateMiddleware,
  isOrderPaid,
  getOrderStatus,
  fulfillOrder,
  PaymentChallenge,
  PaymentProof,
  OrderStatus
} from "augenpay-sdk";

// Create 402 Payment Required response
const challenge: PaymentChallenge = createPaymentChallenge(
  orderId,
  orderData,
  amount,
  merchantPublicKey,
  merchantTokenAccount
);

// Verify payment proof on-chain
const verification = await verifyPaymentProof(
  program,
  orderId,
  {
    ticket: ticketPDA.toBase58(),
    orderHash: hashHex
  }
);

// Gate API endpoints
const gateCheck = paymentGateMiddleware(program, orderId);
if (!gateCheck.allowed) {
  // Return 402 Payment Required
}

// Check order status
const order = getOrderStatus(orderId);
const paid = isOrderPaid(orderId);

// Fulfill order
fulfillOrder(orderId);
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

## Examples

### x402 Payment Challenge (Sandbox)
See `sandbox.ts` for the complete x402 payment challenge demonstration. Run with:
```bash
yarn sandbox
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

### Movie Tickets
See `sandbox.ts` for complete example.

### E-commerce
```typescript
const orderData = {
  orderId: "ORD-12345",
  customerEmail: "customer@example.com",
  items: [
    { productId: "PROD-1", quantity: 2, price: 25_000000 }
  ],
  totalAmount: 50_000000,
  shippingAddress: "123 Main St",
  timestamp: Date.now(),
};

const { ticket } = await redeemService.redeemAllotment(
  program,
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    amount: orderData.totalAmount,
    orderData
  }
);
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

## Testing

### Sandbox (x402 Payment Challenge)

The sandbox (`sandbox.ts`) is a complete end-to-end demonstration that:
- ✅ Creates test tokens and wallets
- ✅ Demonstrates full x402 payment challenge flow
- ✅ Shows API gating with payment middleware
- ✅ Verifies on-chain payment proofs
- ✅ Tests all SDK features

**Run the sandbox:**
```bash
# 1. Generate keypairs (first time only)
yarn generate-keypairs

# 2. Fund wallets at https://faucet.solana.com
# Use: yarn show-wallets to get wallet links

# 3. Run sandbox
yarn sandbox
```

**What to expect:**
- Detailed console output showing each step
- Balance checks and validations
- HTTP 402 Payment Required simulation
- On-chain payment execution
- Payment proof verification
- API unlock demonstration

### Merchant API Server

Test the HTTP server example:
```bash
# Start server
ts-node examples/06-x402-merchant-api.ts

# In another terminal, test endpoints
curl http://localhost:3000/health
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

