import { getUncachableStripeClient } from '../server/stripeClient';

async function createProducts() {
  console.log('Creating PaperGen AI subscription products in Stripe...');
  
  const stripe = await getUncachableStripeClient();
  
  const existingProducts = await stripe.products.search({ 
    query: "active:'true' AND metadata['app']:'papergen'" 
  });
  
  if (existingProducts.data.length > 0) {
    console.log('Products already exist in Stripe:');
    existingProducts.data.forEach(p => console.log(`  - ${p.name} (${p.id})`));
    return;
  }
  
  const dayPassProduct = await stripe.products.create({
    name: 'PaperGen Day Pass',
    description: 'Unlimited document generations for 24 hours',
    metadata: {
      app: 'papergen',
      tier: 'day_pass',
      duration: '1_day',
    },
  });
  console.log(`Created product: ${dayPassProduct.name} (${dayPassProduct.id})`);
  
  const dayPassPrice = await stripe.prices.create({
    product: dayPassProduct.id,
    unit_amount: 100,
    currency: 'usd',
    metadata: {
      tier: 'day_pass',
      display_name: 'Day Pass - $1',
    },
  });
  console.log(`  Created price: $1.00 (${dayPassPrice.id})`);
  
  const weeklyProduct = await stripe.products.create({
    name: 'PaperGen Weekly',
    description: 'Unlimited document generations for 7 days',
    metadata: {
      app: 'papergen',
      tier: 'weekly',
      duration: '7_days',
    },
  });
  console.log(`Created product: ${weeklyProduct.name} (${weeklyProduct.id})`);
  
  const weeklyPrice = await stripe.prices.create({
    product: weeklyProduct.id,
    unit_amount: 300,
    currency: 'usd',
    recurring: { interval: 'week' },
    metadata: {
      tier: 'weekly',
      display_name: 'Weekly - $3/week',
    },
  });
  console.log(`  Created price: $3.00/week (${weeklyPrice.id})`);
  
  const monthlyProduct = await stripe.products.create({
    name: 'PaperGen Monthly',
    description: 'Unlimited document generations for 30 days',
    metadata: {
      app: 'papergen',
      tier: 'monthly',
      duration: '30_days',
    },
  });
  console.log(`Created product: ${monthlyProduct.name} (${monthlyProduct.id})`);
  
  const monthlyPrice = await stripe.prices.create({
    product: monthlyProduct.id,
    unit_amount: 1000,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: {
      tier: 'monthly',
      display_name: 'Monthly - $10/month',
    },
  });
  console.log(`  Created price: $10.00/month (${monthlyPrice.id})`);
  
  const yearlyProduct = await stripe.products.create({
    name: 'PaperGen Yearly',
    description: 'Unlimited document generations for 1 year - Best Value!',
    metadata: {
      app: 'papergen',
      tier: 'yearly',
      duration: '365_days',
    },
  });
  console.log(`Created product: ${yearlyProduct.name} (${yearlyProduct.id})`);
  
  const yearlyPrice = await stripe.prices.create({
    product: yearlyProduct.id,
    unit_amount: 9900,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: {
      tier: 'yearly',
      display_name: 'Yearly - $99/year',
    },
  });
  console.log(`  Created price: $99.00/year (${yearlyPrice.id})`);

  console.log('\nAll products created successfully!');
  console.log('Products will be synced to the database automatically via webhook.');
}

createProducts().catch(console.error);
