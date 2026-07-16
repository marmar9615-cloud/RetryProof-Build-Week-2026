import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http, { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

let db: typeof import("@workspace/db").db;
let auditsTable: typeof import("@workspace/db").auditsTable;
let usersTable: typeof import("@workspace/db").usersTable;
let app: typeof import("../../app").default;
let createSession: typeof import("../../lib/auth").createSession;
let deleteSession: typeof import("../../lib/auth").deleteSession;

let server: Server | undefined;
let baseUrl: string;
let sid: string;
const userId = `test-audit-limit-${randomBytes(6).toString("hex")}`;
const auditIds: string[] = [];

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${sid}` };
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
  usersTable = dbModule.usersTable;
  app = (await import("../../app")).default;
  const authModule = await import("../../lib/auth");
  createSession = authModule.createSession;
  deleteSession = authModule.deleteSession;

  await startServer();

  await db.insert(usersTable).values({
    id: userId,
    email: `${userId}@example.test`,
    firstName: "Limit",
    lastName: "Tester",
  });

  sid = await createSession({
    user: {
      id: userId,
      email: `${userId}@example.test`,
      firstName: "Limit",
      lastName: "Tester",
      profileImageUrl: null,
    },
    access_token: "test-access-token",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
});

afterAll(async () => {
  if (sid) await deleteSession(sid);
  for (const id of auditIds) {
    await db.delete(auditsTable).where(eq(auditsTable.id, id));
  }
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  await stopServer();
});

describeWithDb("audit route hardening", () => {
  it("rejects free authenticated users after their monthly audit allowance", async () => {
    const [existing] = await db
      .insert(auditsTable)
      .values({
        userId,
        requestedChange: "Already used this month's free audit",
        githubUrl: null,
        liveUrl: null,
        status: "done",
      })
      .returning({ id: auditsTable.id });
    auditIds.push(existing.id);

    const res = await fetch(`${baseUrl}/api/audits`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestedChange: "Try to run another audit in the same month",
        githubUrl: null,
        liveUrl: null,
      }),
    });

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      code: "MONTHLY_AUDIT_LIMIT_REACHED",
    });
  });

  it("sets baseline browser security headers", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });
});
