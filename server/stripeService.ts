import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string, 
    priceId: string, 
    successUrl: string, 
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.recurring ? 'subscription' : 'payment';
    
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.products.retrieve(productId);
  }

  async listProducts(active = true) {
    const stripe = await getUncachableStripeClient();
    const products = await stripe.products.list({
      active,
      limit: 100,
    });
    return products.data;
  }

  async listProductsWithPrices(active = true) {
    const stripe = await getUncachableStripeClient();
    
    const products = await stripe.products.list({
      active,
      limit: 100,
    });
    
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 10,
        });
        
        return prices.data.map((price) => ({
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_active: product.active,
          product_metadata: product.metadata,
          price_id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          price_active: price.active,
          price_metadata: price.metadata,
        }));
      })
    );
    
    return productsWithPrices.flat();
  }

  async getPrice(priceId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.prices.retrieve(priceId);
  }

  async getSubscription(subscriptionId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  async getCustomerSubscriptions(customerId: string) {
    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 100,
    });
    return subscriptions.data;
  }
}

export const stripeService = new StripeService();
