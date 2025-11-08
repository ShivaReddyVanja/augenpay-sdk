# AugenPay SDK

TypeScript SDK for interacting with the AugenPay Payment Protocol on Solana.

## Overview

AugenPay enables **delegated payments with on-chain verification**. Users can authorize agents to make payments on their behalf, and merchants can independently verify payments using on-chain data.

## Features

- ✅ **Mandate Management** - Create and manage payment mandates with vaults
- ✅ **Agent Delegation** - Create spending allotments for agents
- ✅ **Payment Execution** - Agents redeem allotments to pay merchants
- ✅ **Hash Verification** - Order data hashed and stored on-chain
- ✅ **Merchant Discovery** - Merchants can query all their payment tickets
- ✅ **Security Controls** - Pause/resume, limits, expiration

## Installation

```bash
cd client
yarn install
```

## Quick Start

### Run the Sandbox Demo

```bash
yarn sandbox
```

This will demonstrate the complete payment flow:
1. User creates mandate
2. User deposits funds
3. User creates allotment for agent
4. Agent buys movie tickets
5. Merchant verifies payment

### Basic Usage

```typescript
import {
  initializeClient,
  mandateService,
  allotmentService,
  redeemService,
  merchantService,
  AUGENPAY_PROGRAM_ID
} from "./index";

// Initialize
const { program } = await initializeClient(
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
    perTxLimit: 100_000000, // 100 tokens
    expiryDays: 30
  }
);

// Deposit funds
await mandateService.depositToMandate(
  program,
  mandate,
  userTokenAccount,
  vault,
  mint,
  userKeypair.publicKey,
  500_000000 // 500 tokens
);

// Create allotment for agent
const { allotment } = await allotmentService.createAllotment(
  program,
  mandate,
  agentPublicKey,
  userKeypair.publicKey,
  {
    allowedAmount: 200_000000,
    ttlHours: 24
  }
);

// Agent executes payment
const { ticket } = await redeemService.payForMovieTickets(
  agentProgram, // Agent's program instance
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    movieName: "Batman",
    numberOfTickets: 2,
    email: "user@example.com",
    pricePerTicket: 10_000000
  }
);

// Merchant verifies payment
const { valid } = await merchantService.verifyTicket(
  program,
  ticket,
  expectedOrderData
);
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
│   └── hashing.ts         # Context hash utilities
├── sandbox.ts             # Complete demo
└── index.ts               # SDK exports
```

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

Orders are hashed using SHA256 before being stored on-chain:

```typescript
import { createMovieTicketHash } from "./utils/hashing";

const { hash, hashHex, orderData } = createMovieTicketHash({
  email: "user@example.com",
  movieName: "Batman",
  numberOfTickets: 2,
  showtime: "7:00 PM"
});

// hash = [array of 32 bytes]
// hashHex = "7a8b9c..." (hex string)
// orderData = { email, movie, ... }
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
// Generic redeem
redeemAllotment(program, params)

// Convenience functions
payForMovieTickets(program, params)
payForEcommerceOrder(program, params)

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

### Movie Tickets
See `sandbox.ts` for complete example.

### E-commerce
```typescript
const { ticket } = await redeemService.payForEcommerceOrder(
  program,
  {
    allotment,
    mandate,
    agent: agentKeypair.publicKey,
    merchant: merchantPublicKey,
    merchantTokenAccount,
    vault,
    mint,
    orderId: "ORD-12345",
    customerEmail: "customer@example.com",
    items: [
      { productId: "PROD-1", quantity: 2, price: 25_000000 }
    ],
    shippingAddress: "123 Main St"
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

The SDK includes a complete test flow in `sandbox.ts` that:
- Creates test tokens
- Demonstrates full payment flow
- Verifies on-chain data
- Tests all features

Run it with:
```bash
yarn sandbox
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

## License

MIT

