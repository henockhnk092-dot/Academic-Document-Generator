// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { type Server } from "node:http";
import express, { type Express } from "express";

export async function serveStatic(app: Express, _server: Server) {
  // Debug: Log deployment version and cwd
  console.log("[DEPLOY v3] Starting serveStatic, cwd:", process.cwd());

  // Use process.cwd() which works reliably in bundled environments
  // On Railway, cwd is /app, and static files are in /app/dist/public
  const distPath = path.resolve(process.cwd(), "dist", "public");
  console.log("[DEPLOY v3] distPath:", distPath);

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

(async () => {
  // Import runApp dynamically after dotenv has loaded
  const { default: runApp } = await import("./app");
  await runApp(serveStatic);
})();
