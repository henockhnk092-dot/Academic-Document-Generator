import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import helmet from "helmet";
import compression from "compression";

import { registerRoutes } from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { PayFastWebhookHandlers, PayFastITNData } from "./payfastWebhookHandlers";
import { isPayFastConfigured } from "./payfastClient";
import { YocoWebhookHandlers } from "./yocoWebhookHandlers";
import { isYocoConfigured, YocoWebhookPayload } from "./yocoClient";
import { BMCWebhookHandlers } from "./bmcWebhookHandlers";
import { isBMCConfigured, BMCWebhookPayload } from "./bmcClient";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled — Vite/React inline scripts would break
  crossOriginEmbedderPolicy: false, // disabled — needed for Google Fonts iframes
}));

// Gzip compression for all responses
app.use(compression());

// Health check (must be before auth/rate-limiting middleware)
app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Check payment provider configuration on startup
function checkPaymentConfig() {
  // Check Buy Me a Coffee first (easiest setup - no business registration needed)
  const bmcConfigured = isBMCConfigured();
  if (bmcConfigured) {
    log('Buy Me a Coffee configured - payments enabled', 'bmc');
  }

  // Check Yoco (preferred for South Africa - simpler verification)
  const yocoConfigured = isYocoConfigured();
  if (yocoConfigured) {
    log('Yoco configured - South African payments enabled', 'yoco');
  }

  // Check PayFast (alternate South African option)
  const payfastConfigured = isPayFastConfigured();
  if (payfastConfigured) {
    log('PayFast configured - South African payments enabled', 'payfast');
  }

  // Also check Stripe as fallback
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (secretKey && publishableKey) {
    log('Stripe configured - international payments enabled', 'stripe');
  }

  if (!bmcConfigured && !yocoConfigured && !payfastConfigured && !secretKey) {
    log('No payment provider configured - payment features disabled', 'payment');
  }
}

checkPaymentConfig();

// PayFast ITN (Instant Transaction Notification) endpoint
// PayFast sends form-urlencoded data, not JSON
// Must be registered BEFORE express.json() middleware
app.post(
  '/api/payfast/notify',
  express.urlencoded({ extended: false }),
  async (req, res) => {
    log('Received PayFast ITN notification', 'payfast');

    try {
      const data = req.body as PayFastITNData;

      if (!data.pf_payment_id) {
        log('Invalid ITN: missing pf_payment_id', 'payfast');
        return res.status(400).send('Invalid ITN data');
      }

      const result = await PayFastWebhookHandlers.processITN(data);

      if (result.success) {
        // PayFast expects a 200 OK with no body on success
        res.status(200).send('OK');
      } else {
        log(`ITN processing failed: ${result.message}`, 'payfast');
        res.status(400).send(result.message);
      }
    } catch (error: any) {
      log(`ITN error: ${error.message}`, 'payfast');
      res.status(500).send('ITN processing error');
    }
  }
);

// Yoco webhook endpoint
// Must be registered BEFORE express.json() middleware
app.post(
  '/api/yoco/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    log('Received Yoco webhook', 'yoco');

    try {
      const signature = req.headers['yoco-signature'] as string | undefined;
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      const payload = JSON.parse(rawBody) as YocoWebhookPayload;

      if (!payload.type || !payload.payload) {
        log('Invalid Yoco webhook: missing required fields', 'yoco');
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const result = await YocoWebhookHandlers.processWebhook(payload, signature, rawBody);

      if (result.success) {
        res.status(200).json({ received: true });
      } else {
        log(`Yoco webhook failed: ${result.message}`, 'yoco');
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      log(`Yoco webhook error: ${error.message}`, 'yoco');
      res.status(500).json({ error: 'Webhook processing error' });
    }
  }
);

// Buy Me a Coffee webhook endpoint
// Must be registered BEFORE express.json() middleware
app.post(
  '/api/bmc/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    log('Received BMC webhook', 'bmc');

    try {
      const signature = req.headers['x-bmc-signature'] as string | undefined;
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
      const payload = JSON.parse(rawBody) as BMCWebhookPayload;

      if (!payload.event || !payload.data) {
        log('Invalid BMC webhook: missing required fields', 'bmc');
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const result = await BMCWebhookHandlers.processWebhook(payload, signature, rawBody);

      if (result.success) {
        res.status(200).json({ received: true });
      } else {
        log(`BMC webhook failed: ${result.message}`, 'bmc');
        res.status(400).json({ error: result.message });
      }
    } catch (error: any) {
      log(`BMC webhook error: ${error.message}`, 'bmc');
      res.status(500).json({ error: 'Webhook processing error' });
    }
  }
);

// Stripe webhook endpoint - must be registered BEFORE express.json() middleware
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        log('Webhook error: req.body is not a Buffer', 'stripe');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      log(`Webhook error: ${error.message}`, 'stripe');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };

  // reusePort is only supported on Linux/Unix, not Windows
  if (process.platform !== 'win32') {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
}
