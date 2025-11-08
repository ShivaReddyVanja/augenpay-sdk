/**
 * Example 11: E-commerce Integration
 * 
 * Complete e-commerce payment flow:
 * - Customer creates mandate and funds it
 * - Customer authorizes payment agent
 * - Agent processes checkout and pays merchant
 * - Merchant verifies payment and fulfills order
 */

import {
  initializeClient,
  AUGENPAY_PROGRAM_ID,
  mandateService,
  allotmentService,
  redeemService,
  merchantService,
} from '../index';
import { Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // in token base units
}

interface Order {
  orderId: string;
  customerEmail: string;
  items: CartItem[];
  shippingAddress: string;
  totalAmount: number;
}

async function ecommerceFlow() {
  // Setup participants
  const customerKeypair = Keypair.generate();
  const paymentAgentKeypair = Keypair.generate(); // Payment processor
  const merchantKeypair = Keypair.generate(); // E-commerce store
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  const client = initializeClient(customerKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  console.log('🛒 E-commerce Payment System');
  console.log('='.repeat(60));
  
  // ============================================
  // STEP 1: Customer Account Setup
  // ============================================
  console.log('\n👤 STEP 1: Customer Account Setup');
  console.log('-'.repeat(60));
  
  // 1.1: Customer creates mandate
  console.log('\n📝 Creating customer payment mandate...');
  const { mandate, vault } = await mandateService.createMandate(
    client.program,
    customerKeypair.publicKey,
    mint,
    {
      perTxLimit: 1000_000000, // Max $1000 per transaction
      expiryDays: 365, // Valid for 1 year
    }
  );
  
  console.log(`✅ Mandate created: ${mandate.toBase58()}`);
  
  // 1.2: Customer deposits funds
  console.log('\n💰 Customer depositing $500 for shopping...');
  const customerTokenAccount = await getAssociatedTokenAddress(
    mint,
    customerKeypair.publicKey
  );
  
  await mandateService.depositToMandate(
    client.program,
    mandate,
    customerTokenAccount,
    vault,
    mint,
    customerKeypair.publicKey,
    500_000000 // $500 USDC
  );
  
  // 1.3: Customer authorizes payment agent
  console.log('\n🔐 Authorizing payment agent...');
  const { allotment } = await allotmentService.createAllotment(
    client.program,
    mandate,
    paymentAgentKeypair.publicKey,
    customerKeypair.publicKey,
    {
      allowedAmount: 300_000000, // Agent can spend up to $300
      ttlHours: 72, // Valid for 3 days
    }
  );
  
  console.log(`✅ Payment agent authorized. Allotment: ${allotment.toBase58()}`);
  
  // ============================================
  // STEP 2: Shopping Cart & Checkout
  // ============================================
  console.log('\n\n🛍️  STEP 2: Shopping Cart & Checkout');
  console.log('-'.repeat(60));
  
  // 2.1: Customer adds items to cart
  const cart: CartItem[] = [
    {
      productId: 'PROD-001',
      name: 'Wireless Headphones',
      quantity: 1,
      price: 99_000000, // $99
    },
    {
      productId: 'PROD-002',
      name: 'USB-C Cable',
      quantity: 2,
      price: 15_000000, // $15 each
    },
  ];
  
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  
  console.log('\n📋 Shopping Cart:');
  cart.forEach(item => {
    console.log(`   ${item.name} x${item.quantity} - $${(item.price * item.quantity) / 1e6}`);
  });
  console.log(`   Total: $${totalAmount / 1e6}`);
  
  // 2.2: Create order
  const order: Order = {
    orderId: `ORD-${Date.now()}`,
    customerEmail: 'customer@example.com',
    items: cart,
    shippingAddress: '123 Main St, City, State 12345',
    totalAmount,
  };
  
  console.log(`\n📝 Order created: ${order.orderId}`);
  
  // ============================================
  // STEP 3: Payment Processing
  // ============================================
  console.log('\n\n💳 STEP 3: Payment Processing');
  console.log('-'.repeat(60));
  
  // 3.1: Payment agent processes checkout
  console.log('\n🔄 Payment agent processing checkout...');
  
  const merchantTokenAccount = await getAssociatedTokenAddress(
    mint,
    merchantKeypair.publicKey
  );
  
  // Prepare order data
  const orderData = {
    orderId: order.orderId,
    customerEmail: order.customerEmail,
    items: order.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    })),
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
    timestamp: Date.now(),
  };
  
  const { ticket, signature } = await redeemService.redeemAllotment(
    client.program,
    {
      allotment,
      mandate,
      agent: paymentAgentKeypair.publicKey,
      merchant: merchantKeypair.publicKey,
      merchantTokenAccount,
      vault,
      mint,
      amount: order.totalAmount,
      orderData,
    }
  );
  
  console.log(`✅ Payment processed!`);
  console.log(`   Ticket: ${ticket.toBase58()}`);
  console.log(`   Transaction: ${signature}`);
  
  // ============================================
  // STEP 4: Merchant Order Fulfillment
  // ============================================
  console.log('\n\n🏪 STEP 4: Merchant Order Fulfillment');
  console.log('-'.repeat(60));
  
  // 4.1: Merchant queries for new payments
  console.log('\n🔍 Merchant checking for new payments...');
  const tickets = await merchantService.fetchMerchantTickets(
    client.program,
    merchantKeypair.publicKey
  );
  
  console.log(`📋 Found ${tickets.length} payment ticket(s)`);
  
  // 4.2: Merchant verifies payment
  console.log('\n✅ Verifying payment...');
  const expectedOrderData = {
    orderId: order.orderId,
    customerEmail: order.customerEmail,
    items: order.items,
    totalAmount: order.totalAmount,
    shippingAddress: order.shippingAddress,
    timestamp: Date.now(),
  };
  
  const { valid, ticketData } = await merchantService.verifyTicket(
    client.program,
    ticket,
    expectedOrderData
  );
  
  if (valid) {
    console.log('✅ Payment verified!');
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Amount: $${ticketData.amount.toNumber() / 1e6}`);
    
    // 4.3: Merchant fulfills order
    console.log('\n📦 Fulfilling order...');
    console.log(`   Customer: ${order.customerEmail}`);
    console.log(`   Shipping: ${order.shippingAddress}`);
    console.log(`   Items:`);
    order.items.forEach(item => {
      console.log(`     - ${item.name} x${item.quantity}`);
    });
    
    // In production: Update database, send confirmation email, 
    // create shipping label, update inventory, etc.
    console.log('\n✅ Order fulfilled!');
    console.log(`   Confirmation: ${ticket.toBase58().slice(0, 16)}...`);
  } else {
    console.log('❌ Payment verification failed!');
    console.log('   Order NOT fulfilled.');
  }
  
  // ============================================
  // Summary
  // ============================================
  console.log('\n\n📊 Order Summary');
  console.log('='.repeat(60));
  console.log(`Order ID: ${order.orderId}`);
  console.log(`Customer: ${customerKeypair.publicKey.toBase58()}`);
  console.log(`Payment Agent: ${paymentAgentKeypair.publicKey.toBase58()}`);
  console.log(`Merchant: ${merchantKeypair.publicKey.toBase58()}`);
  console.log(`Payment Ticket: ${ticket.toBase58()}`);
  console.log(`Total: $${totalAmount / 1e6} USDC`);
  console.log('\n✅ Complete e-commerce flow executed successfully!');
}

// Run the example
ecommerceFlow().catch(console.error);

