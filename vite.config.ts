import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "icons/*.svg"],
      manifest: {
        name: "AcademicGen - AI Document Generator",
        short_name: "AcademicGen",
        description: "AI-powered platform for generating professional academic documents",
        theme_color: "#6366f1",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        categories: ["education", "productivity", "utilities"],
        icons: [
          {
            src: "/icons/icon-72x72.svg",
            sizes: "72x72",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-96x96.svg",
            sizes: "96x96",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-128x128.svg",
            sizes: "128x128",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-144x144.svg",
            sizes: "144x144",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-152x152.svg",
            sizes: "152x152",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-384x384.svg",
            sizes: "384x384",
            type: "image/svg+xml",
            purpose: "maskable any"
          },
          {
            src: "/icons/icon-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable any"
          }
        ],
        shortcuts: [
          {
            name: "Generate Report",
            short_name: "Report",
            url: "/generate/report",
            icons: [{ src: "/icons/icon-96x96.svg", sizes: "96x96" }]
          },
          {
            name: "Generate Presentation",
            short_name: "PPT",
            url: "/generate/powerpoint",
            icons: [{ src: "/icons/icon-96x96.svg", sizes: "96x96" }]
          },
          {
            name: "My Projects",
            short_name: "Projects",
            url: "/projects",
            icons: [{ src: "/icons/icon-96x96.svg", sizes: "96x96" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff,woff2}"],
        globIgnores: ["**/og-image.png"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          const localeMatch = normalizedId.match(/\/client\/src\/i18n\/locales\/([^/]+)\.json$/);
          if (localeMatch) return `locale-${localeMatch[1]}`;
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("pptxgenjs")) return "vendor-pptx";
          if (id.includes("docx")) return "vendor-docx";
          if (id.includes("firebase")) return "vendor-firebase";
          // react/react-dom/scheduler, @radix-ui, wouter, i18next, and the generic
          // "vendor" catch-all were previously split into separate forced chunks,
          // but cross-deps between them (e.g. radix/react-hook-form -> react) created
          // a circular chunk (vendor -> vendor-react -> vendor) that crashed the app
          // in production ("Cannot read properties of undefined (reading 'useState')")
          // because one chunk executed before the other finished initializing.
          // Let Rollup auto-chunk everything else to avoid forcing a cycle.
          return undefined;
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
