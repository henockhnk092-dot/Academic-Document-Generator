import { db, withRetry } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  projects, documents, templates, references, citations,
  aiSessions, aiMessages, grammarSuggestions, userSubscriptions, analyticsEvents,
  type Project, type InsertProject,
  type Document, type InsertDocument,
  type Template, type InsertTemplate,
  type Reference, type InsertReference,
  type Citation, type InsertCitation,
  type AiSession, type InsertAiSession,
  type AiMessage, type InsertAiMessage,
  type GrammarSuggestion, type InsertGrammarSuggestion,
  type UserSubscription, type InsertUserSubscription,
  type AnalyticsEvent, type InsertAnalyticsEvent,
  USAGE_LIMITS
} from "@shared/schema";

export interface IStorage {
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<void>;

  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsByProjectId(projectId: number): Promise<Document[]>;
  getDocumentsByUserId(userId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;

  getTemplates(): Promise<Template[]>;
  getTemplatesByCategory(category: string): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  incrementTemplateUsage(id: number): Promise<void>;

  getReferences(userId: string): Promise<Reference[]>;
  getReference(id: number): Promise<Reference | undefined>;
  createReference(ref: InsertReference): Promise<Reference>;
  updateReference(id: number, updates: Partial<InsertReference>): Promise<Reference | undefined>;
  deleteReference(id: number): Promise<void>;

  getCitationsByReference(referenceId: number): Promise<Citation[]>;
  createCitation(citation: InsertCitation): Promise<Citation>;

  getAiSession(id: number): Promise<AiSession | undefined>;
  getAiSessionsByUser(userId: string): Promise<AiSession[]>;
  createAiSession(session: InsertAiSession): Promise<AiSession>;
  getAiMessages(sessionId: number): Promise<AiMessage[]>;
  createAiMessage(message: InsertAiMessage): Promise<AiMessage>;

  getGrammarSuggestions(documentId: number): Promise<GrammarSuggestion[]>;
  createGrammarSuggestion(suggestion: InsertGrammarSuggestion): Promise<GrammarSuggestion>;
  applyGrammarSuggestion(id: number): Promise<void>;

  getUserSubscription(userId: string): Promise<UserSubscription | undefined>;
  createUserSubscription(sub: InsertUserSubscription): Promise<UserSubscription>;
  updateUserSubscription(userId: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined>;
  incrementUsage(userId: string): Promise<{ success: boolean; attemptsUsed: number; maxAttempts: number }>;

  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsByUser(userId: string): Promise<AnalyticsEvent[]>;
  getAnalyticsSummary(userId: string): Promise<{ totalGenerations: number; byType: Record<string, number> }>;
}

export class DatabaseStorage implements IStorage {
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async getDocumentsByProjectId(projectId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.projectId, projectId)).orderBy(desc(documents.createdAt));
  }

  async getDocumentsByUserId(userId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updated] = await db.update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getTemplates(): Promise<Template[]> {
    return db.select().from(templates).orderBy(desc(templates.usageCount));
  }

  async getTemplatesByCategory(category: string): Promise<Template[]> {
    return db.select().from(templates).where(eq(templates.category, category));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values(template).returning();
    return created;
  }

  async incrementTemplateUsage(id: number): Promise<void> {
    await db.update(templates)
      .set({ usageCount: sql`${templates.usageCount} + 1` })
      .where(eq(templates.id, id));
  }

  async getReferences(userId: string): Promise<Reference[]> {
    return db.select().from(references).where(eq(references.userId, userId)).orderBy(desc(references.createdAt));
  }

  async getReference(id: number): Promise<Reference | undefined> {
    const [ref] = await db.select().from(references).where(eq(references.id, id));
    return ref;
  }

  async createReference(ref: InsertReference): Promise<Reference> {
    const [created] = await db.insert(references).values(ref).returning();
    return created;
  }

  async updateReference(id: number, updates: Partial<InsertReference>): Promise<Reference | undefined> {
    const [updated] = await db.update(references)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(references.id, id))
      .returning();
    return updated;
  }

  async deleteReference(id: number): Promise<void> {
    await db.delete(references).where(eq(references.id, id));
  }

  async getCitationsByReference(referenceId: number): Promise<Citation[]> {
    return db.select().from(citations).where(eq(citations.referenceId, referenceId));
  }

  async createCitation(citation: InsertCitation): Promise<Citation> {
    const [created] = await db.insert(citations).values(citation).returning();
    return created;
  }

  async getAiSession(id: number): Promise<AiSession | undefined> {
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    return session;
  }

  async getAiSessionsByUser(userId: string): Promise<AiSession[]> {
    return db.select().from(aiSessions).where(eq(aiSessions.userId, userId)).orderBy(desc(aiSessions.createdAt));
  }

  async createAiSession(session: InsertAiSession): Promise<AiSession> {
    const [created] = await db.insert(aiSessions).values(session).returning();
    return created;
  }

  async getAiMessages(sessionId: number): Promise<AiMessage[]> {
    return db.select().from(aiMessages).where(eq(aiMessages.sessionId, sessionId)).orderBy(aiMessages.createdAt);
  }

  async createAiMessage(message: InsertAiMessage): Promise<AiMessage> {
    const [created] = await db.insert(aiMessages).values(message).returning();
    return created;
  }

  async getGrammarSuggestions(documentId: number): Promise<GrammarSuggestion[]> {
    return db.select().from(grammarSuggestions).where(eq(grammarSuggestions.documentId, documentId));
  }

  async createGrammarSuggestion(suggestion: InsertGrammarSuggestion): Promise<GrammarSuggestion> {
    const [created] = await db.insert(grammarSuggestions).values(suggestion).returning();
    return created;
  }

  async applyGrammarSuggestion(id: number): Promise<void> {
    await db.update(grammarSuggestions).set({ isApplied: true }).where(eq(grammarSuggestions.id, id));
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | undefined> {
    return withRetry(async () => {
      const [sub] = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, userId));
      return sub;
    });
  }

  async createUserSubscription(sub: InsertUserSubscription): Promise<UserSubscription> {
    return withRetry(async () => {
      const [created] = await db.insert(userSubscriptions).values(sub).returning();
      return created;
    });
  }

  async updateUserSubscription(userId: string, updates: Partial<InsertUserSubscription>): Promise<UserSubscription | undefined> {
    return withRetry(async () => {
      const [updated] = await db.update(userSubscriptions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, userId))
        .returning();
      return updated;
    });
  }

  async incrementUsage(userId: string): Promise<{ success: boolean; attemptsUsed: number; maxAttempts: number }> {
    let sub = await this.getUserSubscription(userId);
    
    if (!sub) {
      sub = await this.createUserSubscription({
        userId,
        subscriptionStatus: "expired",
        subscriptionTier: "free",
        subscriptionExpiry: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        freeAttemptsUsed: 0,
        maxFreeAttempts: USAGE_LIMITS.freeUser,
      });
    }

    if (sub.subscriptionStatus === "active" && sub.subscriptionExpiry) {
      const expiry = new Date(sub.subscriptionExpiry);
      if (expiry > new Date()) {
        return { success: true, attemptsUsed: sub.freeAttemptsUsed || 0, maxAttempts: Infinity };
      }
    }

    const attemptsUsed = sub.freeAttemptsUsed || 0;
    const maxAttempts = sub.maxFreeAttempts || USAGE_LIMITS.freeUser;

    if (attemptsUsed >= maxAttempts) {
      return { success: false, attemptsUsed, maxAttempts };
    }

    const updated = await this.updateUserSubscription(userId, {
      freeAttemptsUsed: attemptsUsed + 1,
    });

    return {
      success: true,
      attemptsUsed: updated?.freeAttemptsUsed || attemptsUsed + 1,
      maxAttempts,
    };
  }

  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [created] = await db.insert(analyticsEvents).values(event).returning();
    return created;
  }

  async getAnalyticsByUser(userId: string): Promise<AnalyticsEvent[]> {
    return db.select().from(analyticsEvents).where(eq(analyticsEvents.userId, userId)).orderBy(desc(analyticsEvents.createdAt));
  }

  async getAnalyticsSummary(userId: string): Promise<{ totalGenerations: number; byType: Record<string, number> }> {
    const events = await db.select().from(analyticsEvents)
      .where(and(eq(analyticsEvents.userId, userId), eq(analyticsEvents.eventType, "generation")));
    
    const byType: Record<string, number> = {};
    for (const event of events) {
      if (event.documentType) {
        byType[event.documentType] = (byType[event.documentType] || 0) + 1;
      }
    }
    
    return { totalGenerations: events.length, byType };
  }
}

export const storage = new DatabaseStorage();
