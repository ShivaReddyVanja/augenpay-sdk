/**
 * Example 10: Movie Ticket Booking Flow
 * 
 * Complete end-to-end example for a movie ticket booking system:
 * - User creates mandate and funds it
 * - User authorizes agent (booking service) to buy tickets
 * - Agent purchases tickets on user's behalf
 * - Theater (merchant) verifies payment and issues tickets
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

interface MovieBooking {
  movieName: string;
  showtime: string;
  numberOfTickets: number;
  pricePerTicket: number;
  customerEmail: string;
  seatNumbers?: string[];
}

async function movieTicketFlow() {
  // Setup participants
  const customerKeypair = Keypair.generate();
  const bookingAgentKeypair = Keypair.generate(); // Booking service
  const theaterKeypair = Keypair.generate(); // Movie theater
  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC
  
  const client = initializeClient(customerKeypair, 'devnet', AUGENPAY_PROGRAM_ID);
  
  console.log('🎬 Movie Ticket Booking System');
  console.log('='.repeat(60));
  
  // ============================================
  // STEP 1: Customer Setup
  // ============================================
  console.log('\n👤 STEP 1: Customer Setup');
  console.log('-'.repeat(60));
  
  // 1.1: Customer creates mandate
  console.log('\n📝 Customer creating mandate...');
  const { mandate, vault } = await mandateService.createMandate(
    client.program,
    customerKeypair.publicKey,
    mint,
    {
      perTxLimit: 500_000000, // Max $500 per transaction
      expiryDays: 90, // Valid for 90 days
    }
  );
  
  console.log(`✅ Mandate created: ${mandate.toBase58()}`);
  
  // 1.2: Customer deposits funds
  console.log('\n💰 Customer depositing $200 for ticket purchases...');
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
    200_000000 // $200 USDC
  );
  
  // 1.3: Customer authorizes booking agent
  console.log('\n🎫 Customer authorizing booking agent...');
  const { allotment } = await allotmentService.createAllotment(
    client.program,
    mandate,
    bookingAgentKeypair.publicKey,
    customerKeypair.publicKey,
    {
      allowedAmount: 150_000000, // Agent can spend up to $150
      ttlHours: 48, // Valid for 48 hours
    }
  );
  
  console.log(`✅ Agent authorized. Allotment: ${allotment.toBase58()}`);
  
  // ============================================
  // STEP 2: Booking Process
  // ============================================
  console.log('\n\n🎟️  STEP 2: Booking Process');
  console.log('-'.repeat(60));
  
  // 2.1: Customer requests booking
  const booking: MovieBooking = {
    movieName: 'The Matrix',
    showtime: '2024-12-25T19:00:00Z',
    numberOfTickets: 2,
    pricePerTicket: 15_000000, // $15 per ticket
    customerEmail: 'customer@example.com',
    seatNumbers: ['A12', 'A13'],
  };
  
  const totalCost = booking.numberOfTickets * booking.pricePerTicket;
  console.log(`\n📋 Booking Request:`);
  console.log(`   Movie: ${booking.movieName}`);
  console.log(`   Showtime: ${booking.showtime}`);
  console.log(`   Tickets: ${booking.numberOfTickets}`);
  console.log(`   Total: $${totalCost / 1e6}`);
  
  // 2.2: Agent processes booking and executes payment
  console.log('\n💳 Agent processing payment...');
  
  const theaterTokenAccount = await getAssociatedTokenAddress(
    mint,
    theaterKeypair.publicKey
  );
  
  // Prepare order data
  const orderData = {
    email: booking.customerEmail,
    movie: booking.movieName,
    numberOfTickets: booking.numberOfTickets,
    showtime: booking.showtime,
    pricePerTicket: booking.pricePerTicket,
    timestamp: Date.now(),
  };
  
  const totalAmount = booking.numberOfTickets * booking.pricePerTicket;
  
  const { ticket, signature } = await redeemService.redeemAllotment(
    client.program,
    {
      allotment,
      mandate,
      agent: bookingAgentKeypair.publicKey,
      merchant: theaterKeypair.publicKey,
      merchantTokenAccount: theaterTokenAccount,
      vault,
      mint,
      amount: totalAmount,
      orderData,
    }
  );
  
  console.log(`✅ Payment executed!`);
  console.log(`   Ticket PDA: ${ticket.toBase58()}`);
  console.log(`   Transaction: ${signature}`);
  
  // ============================================
  // STEP 3: Theater Verification
  // ============================================
  console.log('\n\n🏛️  STEP 3: Theater Verification');
  console.log('-'.repeat(60));
  
  // 3.1: Theater queries for new payments
  console.log('\n🔍 Theater querying for payments...');
  const tickets = await merchantService.fetchMerchantTickets(
    client.program,
    theaterKeypair.publicKey
  );
  
  console.log(`📋 Found ${tickets.length} payment ticket(s)`);
  
  // 3.2: Theater verifies the payment
  console.log('\n✅ Verifying payment...');
  const expectedOrderData = {
    email: booking.customerEmail,
    movie: booking.movieName,
    numberOfTickets: booking.numberOfTickets,
    showtime: booking.showtime,
    pricePerTicket: booking.pricePerTicket,
    timestamp: Date.now(),
  };
  
  const { valid, ticketData } = await merchantService.verifyTicket(
    client.program,
    ticket,
    expectedOrderData
  );
  
  if (valid) {
    console.log('✅ Payment verified!');
    console.log(`   Amount: $${ticketData.amount.toNumber() / 1e6}`);
    console.log(`   Timestamp: ${new Date(ticketData.timestamp.toNumber() * 1000).toISOString()}`);
    
    // 3.3: Theater issues tickets
    console.log('\n🎫 Issuing tickets to customer...');
    console.log(`   Email: ${booking.customerEmail}`);
    console.log(`   Movie: ${booking.movieName}`);
    console.log(`   Showtime: ${booking.showtime}`);
    console.log(`   Seats: ${booking.seatNumbers?.join(', ')}`);
    console.log(`   Confirmation: ${ticket.toBase58().slice(0, 16)}...`);
    
    // In production, send email with QR code, update database, etc.
    console.log('\n✅ Tickets issued successfully!');
  } else {
    console.log('❌ Payment verification failed!');
    console.log('   Tickets NOT issued.');
  }
  
  // ============================================
  // Summary
  // ============================================
  console.log('\n\n📊 Summary');
  console.log('='.repeat(60));
  console.log(`Customer: ${customerKeypair.publicKey.toBase58()}`);
  console.log(`Booking Agent: ${bookingAgentKeypair.publicKey.toBase58()}`);
  console.log(`Theater: ${theaterKeypair.publicKey.toBase58()}`);
  console.log(`Payment Ticket: ${ticket.toBase58()}`);
  console.log(`Amount Paid: $${totalCost / 1e6} USDC`);
  console.log('\n✅ Complete booking flow executed successfully!');
}

// Run the example
movieTicketFlow().catch(console.error);

