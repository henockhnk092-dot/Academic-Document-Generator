import Stripe from 'stripe';
import { getStripeClient, getStripeWebhookSecret } from './stripeClient';
import { firebaseSubscriptionStorage } from './firebaseSubscriptionStorage';
import { log } from './app';

export class WebhookHandlers {
  /**
   * Process Stripe webhook events
   */
  static async processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const stripe = getStripeClient();
    let webhookSecret: string;

    try {
      webhookSecret = getStripeWebhookSecret();
    } catch {
      // If no webhook secret, just parse the event without verification (for testing)
      log('Warning: No STRIPE_WEBHOOK_SECRET set, webhook verification disabled', 'stripe');
      return JSON.parse(payload.toString()) as Stripe.Event;
    }

    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    // Handle the event
    await this.handleEvent(event);

    return event;
  }

  /**
   * Handle specific Stripe events
   */
  private static async handleEvent(event: Stripe.Event): Promise<void> {
    log(`Processing webhook event: ${event.type}`, 'stripe');

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        log(`Unhandled event type: ${event.type}`, 'stripe');
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    log(`Checkout completed: ${session.id}`, 'stripe');

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerId) {
      log('No customer ID in checkout session', 'stripe');
      return;
    }

    // Get user from metadata or find by customer ID
    const metadata = session.metadata || {};
    const userId = metadata.userId;

    if (userId) {
      // Link customer ID to user
      await firebaseSubscriptionStorage.setStripeCustomerId(userId, customerId);
      log(`Linked customer ${customerId} to user ${userId}`, 'stripe');
    }

    if (subscriptionId) {
      // Fetch the subscription details
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await this.handleSubscriptionUpdated(subscription);
    }
  }

  /**
   * Handle subscription created/updated events
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    log(`Subscription updated: ${subscription.id} for customer ${customerId}`, 'stripe');

    // Find user by customer ID
    const userSubscription = await firebaseSubscriptionStorage.getSubscriptionByCustomerId(customerId);

    if (!userSubscription) {
      log(`No user found for customer ${customerId}`, 'stripe');
      return;
    }

    // Determine tier from product metadata or price
    const tier = this.getTierFromSubscription(subscription);
    const expiryDate = new Date(((subscription as any).current_period_end ?? 0) * 1000);
    const status = subscription.status === 'active' ? 'active' : 'expired';

    await firebaseSubscriptionStorage.updateUserSubscription(userSubscription.userId, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionTier: tier,
      subscriptionExpiry: expiryDate,
    });

    log(`Updated subscription for user ${userSubscription.userId}: ${status} ${tier}`, 'stripe');
  }

  /**
   * Handle subscription deleted event
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    log(`Subscription deleted: ${subscription.id} for customer ${customerId}`, 'stripe');

    const userSubscription = await firebaseSubscriptionStorage.getSubscriptionByCustomerId(customerId);

    if (!userSubscription) {
      log(`No user found for customer ${customerId}`, 'stripe');
      return;
    }

    await firebaseSubscriptionStorage.cancelSubscription(userSubscription.userId);
    log(`Cancelled subscription for user ${userSubscription.userId}`, 'stripe');
  }

  /**
   * Handle successful invoice payment
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const subscriptionId = (invoice as any).subscription as string;

    log(`Invoice paid for customer ${customerId}`, 'stripe');

    if (subscriptionId) {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await this.handleSubscriptionUpdated(subscription);
    }
  }

  /**
   * Handle failed invoice payment
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    log(`Invoice payment failed for customer ${customerId}`, 'stripe');

    const userSubscription = await firebaseSubscriptionStorage.getSubscriptionByCustomerId(customerId);

    if (userSubscription) {
      await firebaseSubscriptionStorage.updateUserSubscription(userSubscription.userId, {
        subscriptionStatus: 'past_due',
      });
      log(`Marked subscription as past_due for user ${userSubscription.userId}`, 'stripe');
    }
  }

  /**
   * Determine subscription tier from Stripe subscription
   */
  private static getTierFromSubscription(subscription: Stripe.Subscription): string {
    // Try to get tier from product metadata
    const items = subscription.items.data;
    if (items.length > 0) {
      const price = items[0].price;
      const metadata = price.metadata || {};

      if (metadata.tier) {
        return metadata.tier;
      }

      // Infer tier from interval
      if (price.recurring) {
        const interval = price.recurring.interval;
        const intervalCount = price.recurring.interval_count;

        if (interval === 'day' && intervalCount === 1) return 'day_pass';
        if (interval === 'week' && intervalCount === 1) return 'weekly';
        if (interval === 'month' && intervalCount === 1) return 'monthly';
        if (interval === 'year' && intervalCount === 1) return 'yearly';
      }
    }

    return 'subscription';
  }
}
