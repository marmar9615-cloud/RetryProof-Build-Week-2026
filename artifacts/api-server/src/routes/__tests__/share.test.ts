import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http, { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

let db: typeof import("@workspace/db").db;
let auditsTable: typeof import("@workspace/db").auditsTable;
let reportsTable: typeof import("@workspace/db").reportsTable;
let usersTable: typeof import("@workspace/db").usersTable;
let app: typeof import("../../app").default;
let createSession: typeof import("../../lib/auth").createSession;
let deleteSession: typeof import("../../lib/auth").deleteSession;

let server: Server | undefined;
let baseUrl: string;

const ownerId = `test-owner-${randomBytes(6).toString("hex")}`;
const otherId = `test-other-${randomBytes(6).toString("hex")}`;
const userIds = [ownerId, otherId];

let auditId: string;
let reportId: string;
let ownerSid: string;
let otherSid: string;

async function makeUser(id: string) {
  await db
    .insert(usersTable)
    .values({
      id,
      email: `${id}@example.test`,
      firstName: "Test",
      lastName: "User",
    })
    .onConflictDoNothing();
}

async function makeSessionFor(id: string): Promise<string> {
  return createSession({
    user: {
      id,
      email: `${id}@example.test`,
      firstName: "Test",
      lastName: "User",
      profileImageUrl: null,
    },
    access_token: "test-access-token",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
}

function authHeaders(sid?: string): Record<string, string> {
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}

async function startServer(): Promise<void> {
  await new Promise<void>((resolve) => {
    const s = http.createServer(app);
    server = s;
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  const s = server;
  if (!s) return;
  await new Promise<void>((resolve, reject) => {
    s.close((err) => (err ? reject(err) : resolve()));
  });
}

beforeAll(async () => {
  const dbModule = await import("@workspace/db");
  db = dbModule.db;
  auditsTable = dbModule.auditsTable;
  reportsTable = dbModule.reportsTable;
  usersTable = dbModule.usersTable;
  app = (await import("../../app")).default;
  const authModule = await import("../../lib/auth");
  createSession = authModule.createSession;
  deleteSession = authModule.deleteSession;

  await startServer();

  await makeUser(ownerId);
  await makeUser(otherId);

  const [audit] = await db
    .insert(auditsTable)
    .values({
      userId: ownerId,
      requestedChange: "Test change for share-link integration tests",
      githubUrl: null,
      liveUrl: null,
    })
    .returning();
  auditId = audit.id;

  const [report] = await db
    .insert(reportsTable)
    .values({
      auditId,
      source: "demo",
      architectureSummary: "summary",
      mermaidGraph: "graph TD; A-->B;",
      riskyAssumptions: [],
      acceptanceCriteria: [],
      promptPack: { replit: "x", cursor: "x", copilot: "x", claudeCode: "x", codex: "x" },
      rolloutNotes: "notes",
    })
    .returning();
  reportId = report.id;

  ownerSid = await makeSessionFor(ownerId);
  otherSid = await makeSessionFor(otherId);
});

afterAll(async () => {
  await Promise.all(
    [ownerSid, otherSid].filter(Boolean).map((sid) => deleteSession(sid)),
  );
  if (reportId) await db.delete(reportsTable).where(eq(reportsTable.id, reportId));
  if (auditId) await db.delete(auditsTable).where(eq(auditsTable.id, auditId));
  await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  await stopServer();
});

describeWithDb("share routes", () => {
  describe("DELETE /api/audits/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/audits/${auditId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when authenticated as a non-owner", async () => {
      const res = await fetch(`${baseUrl}/api/audits/${auditId}`, {
        method: "DELETE",
        headers: authHeaders(otherSid),
      });
      expect(res.status).toBe(404);
    });

    it("deletes an owned audit and cascades the report", async () => {
      const [ownedAudit] = await db
        .insert(auditsTable)
        .values({
          userId: ownerId,
          requestedChange: "Delete this audit during integration tests",
          githubUrl: null,
          liveUrl: null,
        })
        .returning();

      const [ownedReport] = await db
        .insert(reportsTable)
        .values({
          auditId: ownedAudit.id,
          source: "demo",
          architectureSummary: "summary",
          mermaidGraph: "graph TD; A-->B;",
          riskyAssumptions: [],
          acceptanceCriteria: [],
          promptPack: { replit: "x", cursor: "x", copilot: "x", claudeCode: "x", codex: "x" },
          rolloutNotes: "notes",
        })
        .returning();

      const res = await fetch(`${baseUrl}/api/audits/${ownedAudit.id}`, {
        method: "DELETE",
        headers: authHeaders(ownerSid),
      });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ success: true });

      const [deletedAudit] = await db
        .select()
        .from(auditsTable)
        .where(eq(auditsTable.id, ownedAudit.id));
      expect(deletedAudit).toBeUndefined();

      const [deletedReport] = await db
        .select()
        .from(reportsTable)
        .where(eq(reportsTable.id, ownedReport.id));
      expect(deletedReport).toBeUndefined();
    });
  });

  describe("POST /api/reports/:id/share", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when authenticated as a non-owner", async () => {
      const res = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
        headers: authHeaders(otherSid),
      });
      expect(res.status).toBe(404);
    });

    it("returns 200 with a slug for the owner and is idempotent", async () => {
      const res1 = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
        headers: authHeaders(ownerSid),
      });
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as {
        shareSlug: string;
        shareUrl: string;
      };
      expect(typeof body1.shareSlug).toBe("string");
      expect(body1.shareSlug.length).toBeGreaterThan(0);
      expect(body1.shareUrl).toContain(`/r/${body1.shareSlug}`);

      const res2 = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
        headers: authHeaders(ownerSid),
      });
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { shareSlug: string };
      expect(body2.shareSlug).toBe(body1.shareSlug);

      const [persisted] = await db
        .select({ shareSlug: reportsTable.shareSlug })
        .from(reportsTable)
        .where(eq(reportsTable.id, reportId));
      expect(persisted.shareSlug).toBe(body1.shareSlug);
    });
  });

  describe("DELETE /api/reports/:id/share", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when authenticated as a non-owner", async () => {
      const res = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "DELETE",
        headers: authHeaders(otherSid),
      });
      expect(res.status).toBe(404);
    });

    it("clears shareSlug for the owner and makes the public URL 404", async () => {
      const mintRes = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
        headers: authHeaders(ownerSid),
      });
      expect(mintRes.status).toBe(200);
      const { shareSlug } = (await mintRes.json()) as { shareSlug: string };

      const beforePublic = await fetch(`${baseUrl}/api/r/${shareSlug}`);
      expect(beforePublic.status).toBe(200);

      const revokeRes = await fetch(
        `${baseUrl}/api/reports/${reportId}/share`,
        { method: "DELETE", headers: authHeaders(ownerSid) },
      );
      expect(revokeRes.status).toBe(200);
      const revokeBody = (await revokeRes.json()) as { success: boolean };
      expect(revokeBody.success).toBe(true);

      const [persisted] = await db
        .select({ shareSlug: reportsTable.shareSlug })
        .from(reportsTable)
        .where(eq(reportsTable.id, reportId));
      expect(persisted.shareSlug).toBeNull();

      const afterPublic = await fetch(`${baseUrl}/api/r/${shareSlug}`);
      expect(afterPublic.status).toBe(404);
    });

    it("is a no-op (200) when no share slug exists", async () => {
      const res = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "DELETE",
        headers: authHeaders(ownerSid),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/r/:slug", () => {
    it("returns 200 publicly (no auth required) for a known slug", async () => {
      const mintRes = await fetch(`${baseUrl}/api/reports/${reportId}/share`, {
        method: "POST",
        headers: authHeaders(ownerSid),
      });
      expect(mintRes.status).toBe(200);
      const { shareSlug } = (await mintRes.json()) as { shareSlug: string };

      const res = await fetch(`${baseUrl}/api/r/${shareSlug}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        report: { id: string; shareSlug: string };
        audit: { requestedChange: string };
      };
      expect(body.report.id).toBe(reportId);
      expect(body.report.shareSlug).toBe(shareSlug);
      expect(body.audit.requestedChange).toContain("Test change");
    });

    it("returns 404 for an unknown slug", async () => {
      const res = await fetch(`${baseUrl}/api/r/does-not-exist-${randomBytes(4).toString("hex")}`);
      expect(res.status).toBe(404);
    });
  });
});
