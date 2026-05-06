import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export type DocumentType = "report" | "powerpoint" | "conference" | "thesis";
export type ToneType = "academic" | "professional" | "essay" | "creative";
export type CitationStyleType = "apa" | "mla" | "chicago" | "ieee" | "harvard";
export type TemplateCategory = "report" | "presentation" | "paper" | "thesis" | "essay";
export type LanguageCode = "en" | "es" | "fr" | "de" | "zh" | "ja" | "ko" | "pt" | "it" | "ru";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  status: text("status").default("draft"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  documents: many(documents),
  aiSessions: many(aiSessions),
}));

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  topic: text("topic"),
  content: jsonb("content"),
  settings: jsonb("settings"),
  version: integer("version").default(1),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
}));

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  type: text("type").notNull(),
  structure: jsonb("structure").notNull(),
  previewImage: text("preview_image"),
  isDefault: boolean("is_default").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const references = pgTable("references", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  authors: text("authors"),
  year: text("year"),
  source: text("source"),
  url: text("url"),
  doi: text("doi"),
  type: text("type").default("article"),
  notes: text("notes"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const citations = pgTable("citations", {
  id: serial("id").primaryKey(),
  referenceId: integer("reference_id").references(() => references.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  style: text("style").notNull(),
  formattedCitation: text("formatted_citation").notNull(),
  inTextCitation: text("in_text_citation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citationsRelations = relations(citations, ({ one }) => ({
  reference: one(references, {
    fields: [citations.referenceId],
    references: [references.id],
  }),
}));

export const aiSessions = pgTable("ai_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }),
  sessionType: text("session_type").default("writing_assistant"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiSessionsRelations = relations(aiSessions, ({ one, many }) => ({
  project: one(projects, {
    fields: [aiSessions.projectId],
    references: [projects.id],
  }),
  document: one(documents, {
    fields: [aiSessions.documentId],
    references: [documents.id],
  }),
  messages: many(aiMessages),
}));

export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => aiSessions.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  session: one(aiSessions, {
    fields: [aiMessages.sessionId],
    references: [aiSessions.id],
  }),
}));

export const grammarSuggestions = pgTable("grammar_suggestions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  documentId: integer("document_id").references(() => documents.id, { onDelete: "cascade" }),
  originalText: text("original_text").notNull(),
  suggestedText: text("suggested_text").notNull(),
  suggestionType: text("suggestion_type"),
  explanation: text("explanation"),
  isApplied: boolean("is_applied").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  email: text("email"),
  subscriptionStatus: text("subscription_status").default("expired"),
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionExpiry: timestamp("subscription_expiry"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  freeAttemptsUsed: integer("free_attempts_used").default(0),
  maxFreeAttempts: integer("max_free_attempts").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  documentType: text("document_type"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export const insertReferenceSchema = createInsertSchema(references).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCitationSchema = createInsertSchema(citations).omit({ id: true, createdAt: true });
export const insertAiSessionSchema = createInsertSchema(aiSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({ id: true, createdAt: true });
export const insertGrammarSuggestionSchema = createInsertSchema(grammarSuggestions).omit({ id: true, createdAt: true });
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ id: true, createdAt: true });

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Reference = typeof references.$inferSelect;
export type InsertReference = z.infer<typeof insertReferenceSchema>;
export type Citation = typeof citations.$inferSelect;
export type InsertCitation = z.infer<typeof insertCitationSchema>;
export type AiSession = typeof aiSessions.$inferSelect;
export type InsertAiSession = z.infer<typeof insertAiSessionSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type GrammarSuggestion = typeof grammarSuggestions.$inferSelect;
export type InsertGrammarSuggestion = z.infer<typeof insertGrammarSuggestionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

export const CITATION_STYLES: CitationStyleType[] = ["apa", "mla", "chicago", "ieee", "harvard"];

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
] as const;

export const PRICING_TIERS = {
  day_pass: { name: "Day Pass", price: 1.00, description: "Perfect for a quick, one-time project.", duration: 1 },
  weekly: { name: "Weekly", price: 3.00, description: "Great for short-term sprints.", duration: 7 },
  monthly: { name: "Monthly", price: 10.00, description: "Save ~17% vs Weekly. Most popular.", duration: 30 },
  yearly: { name: "Yearly", price: 99.00, description: "Best Value. Get 2 months free.", duration: 365 },
} as const;

export const USAGE_LIMITS = {
  guest: 3,
  freeUser: 5,
} as const;
