import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import compression from "compression";

import { registerRoutes } from "./routes";
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
  if (isBMCConfigured()) {
    log('Buy Me a Coffee configured - payments enabled', 'bmc');
  } else {
    log('No payment provider configured - payment features disabled', 'payment');
  }
}

checkPaymentConfig();

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown webhook error";
      log(`BMC webhook error: ${message}`, 'bmc');
      res.status(500).json({ error: 'Webhook processing error' });
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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const maybeStatus = typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: unknown }).statusCode
        : undefined;
    const status = Number(maybeStatus) || 500;
    const message = err instanceof Error ? err.message : "Internal Server Error";

    res.status(status).json({ message });
    log(`Unhandled request error: ${message}`, "error");
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  const listenOptions: {
    port: number;
    host: string;
    reusePort?: boolean;
  } = {
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
