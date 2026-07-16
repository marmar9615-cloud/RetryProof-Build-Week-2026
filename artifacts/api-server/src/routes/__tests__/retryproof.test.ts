import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http, { type Server } from "node:http";
import { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

let server: Server | undefined;
let baseUrl: string;

function cookieFrom(response: Response): string {
  const value = response.headers.get("set-cookie");
  if (!value) throw new Error("RetryProof did not set its anonymous session cookie.");
  return value.split(";", 1)[0];
}

async function startServer(): Promise<void> {
  process.env.SESSION_SECRET ||= "retryproof-integration-session-secret";
  const app = (await import("../../app")).default;
  await new Promise<void>((resolve) => {
    const instance = http.createServer(app);
    server = instance;
    instance.listen(0, "127.0.0.1", () => {
      const { port } = instance.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server!.close((error) => (error ? reject(error) : resolve()));
  });
}

beforeAll(startServer);
afterAll(stopServer);

describeWithDb("RetryProof integrated API", () => {
  it("runs the complete anonymous red-to-green journey and downloads evidence", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`);
    expect(sessionResponse.status).toBe(200);
    const cookie = cookieFrom(sessionResponse);
    expect(cookie).toMatch(/^retryproof_session=/);
    expect(cookie).not.toMatch(/^sid=/);
    const session = (await sessionResponse.json()) as { session: { csrfToken: string; state: Record<string, unknown> } };
    expect(session.session.state).toEqual({});
    const headers = {
      cookie,
      "content-type": "application/json",
      "x-csrf-token": session.session.csrfToken,
    };

    const importResponse = await fetch(`${baseUrl}/api/retryproof/v1/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ demo: true }),
    });
    expect(importResponse.status).toBe(201);
    const imported = (await importResponse.json()) as { workflow: { id: string } };

    const analysisResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/workflows/${imported.workflow.id}/analyses`,
      { method: "POST", headers, body: JSON.stringify({ mode: "cached" }) },
    );
    expect(analysisResponse.status).toBe(201);
    const analyzed = (await analysisResponse.json()) as {
      analysis: { id: string; planHash: string; invariant: { statement: string } };
    };

    const approvalResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/plan`,
      {
        method: "PATCH",
        headers: { ...headers, "if-match": analyzed.analysis.planHash },
        body: JSON.stringify({ approved: true, statement: analyzed.analysis.invariant.statement }),
      },
    );
    expect(approvalResponse.status).toBe(200);

    const scenariosResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/scenarios`,
      { method: "POST", headers, body: JSON.stringify({ scenarioIds: ["timeout_after_refund"] }) },
    );
    expect(scenariosResponse.status).toBe(201);

    const oversizedSeedResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/executions`,
      { method: "POST", headers, body: JSON.stringify({ phase: "before", seed: "x".repeat(129) }) },
    );
    expect(oversizedSeedResponse.status).toBe(422);
    await expect(oversizedSeedResponse.json()).resolves.toMatchObject({ error: { code: "SEED_TOO_LONG" } });

    const beforeResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/executions`,
      { method: "POST", headers, body: JSON.stringify({ phase: "before", seed: "demo-v1" }) },
    );
    expect(beforeResponse.status).toBe(201);
    await expect(beforeResponse.json()).resolves.toMatchObject({
      execution: { passed: false, effectCount: 2, scenarioId: "timeout_after_refund" },
    });

    const repairResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/repairs`,
      { method: "POST", headers, body: JSON.stringify({ mode: "cached" }) },
    );
    expect(repairResponse.status).toBe(201);
    const repaired = (await repairResponse.json()) as { repair: { id: string } };

    const recheckResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/repairs/${repaired.repair.id}/recheck`,
      { method: "POST", headers, body: "{}" },
    );
    expect(recheckResponse.status).toBe(201);
    const rechecked = (await recheckResponse.json()) as { artifact: { id: string; sha256: string }; execution: { passed: boolean; effectCount: number } };
    expect(rechecked.execution).toMatchObject({ passed: true, effectCount: 1 });

    const restoredResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`, { headers: { cookie } });
    expect(restoredResponse.status).toBe(200);
    await expect(restoredResponse.json()).resolves.toMatchObject({
      session: {
        state: {
          workflow: { id: imported.workflow.id },
          analysis: { id: analyzed.analysis.id },
          before: { passed: false, effectCount: 2 },
          repair: { id: repaired.repair.id },
          after: { passed: true, effectCount: 1 },
          artifact: { id: rechecked.artifact.id },
        },
      },
    });

    const downloadResponse = await fetch(
      `${baseUrl}/api/retryproof/v1/artifacts/${rechecked.artifact.id}/download`,
      { headers: { cookie } },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toContain("application/zip");
    const archiveBytes = new Uint8Array(await downloadResponse.arrayBuffer());
    expect(archiveBytes.byteLength).toBeGreaterThan(500);
    const receiptBytes = unzipSync(archiveBytes)["receipt.json"];
    expect(receiptBytes).toBeDefined();
    expect(createHash("sha256").update(receiptBytes!).digest("hex")).toBe(rechecked.artifact.sha256);
    expect(JSON.parse(strFromU8(receiptBytes!))).toMatchObject({
      before: { effectCount: 2, passed: false },
      after: { effectCount: 1, passed: true },
    });

    const deleteResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`, {
      method: "DELETE",
      headers,
    });
    expect(deleteResponse.status).toBe(200);
  });

  it("runs an uploaded supported workflow through analysis, repair, replay, and export", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`, {
      headers: { "user-agent": `retryproof-custom-e2e-${Date.now()}` },
    });
    const cookie = cookieFrom(sessionResponse);
    const session = (await sessionResponse.json()) as { session: { csrfToken: string } };
    const headers = { cookie, "content-type": "application/json", "x-csrf-token": session.session.csrfToken };
    const rawWorkflow = JSON.stringify({
      name: "Create CRM lead safely",
      nodes: [
        { id: "lead_hook", name: "Lead webhook", type: "n8n-nodes-base.webhook", position: [0, 0], parameters: {} },
        { id: "shape_lead", name: "Shape lead", type: "n8n-nodes-base.set", position: [200, 0], parameters: {} },
        { id: "create_lead", name: "Create lead", type: "n8n-nodes-base.httpRequest", position: [400, 0], parameters: { method: "POST", url: "mock://leads", body: { lead_id: "={{ $json.lead.id }}" } } },
        { id: "lead_response", name: "Acknowledge lead", type: "n8n-nodes-base.respondToWebhook", position: [600, 0], parameters: {} },
      ],
      connections: {
        "Lead webhook": { main: [[{ node: "Shape lead", type: "main", index: 0 }]] },
        "Shape lead": { main: [[{ node: "Create lead", type: "main", index: 0 }]] },
        "Create lead": { main: [[{ node: "Acknowledge lead", type: "main", index: 0 }]] },
      },
    });
    const importedResponse = await fetch(`${baseUrl}/api/retryproof/v1/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ rawWorkflow, fixture: { lead: { id: "lead_42" } } }),
    });
    expect(importedResponse.status).toBe(201);
    const imported = await importedResponse.json() as { workflow: { id: string }; fixture: unknown };
    expect(imported.fixture).toEqual({ lead: { id: "lead_42" } });

    const analyzedResponse = await fetch(`${baseUrl}/api/retryproof/v1/workflows/${imported.workflow.id}/analyses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "deterministic" }),
    });
    expect(analyzedResponse.status).toBe(201);
    const analyzed = await analyzedResponse.json() as { analysis: { id: string; planHash: string; invariant: { statement: string }; scenarios: unknown[] } };
    expect(analyzed.analysis.scenarios).toHaveLength(4);

    const approvedResponse = await fetch(`${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/plan`, {
      method: "PATCH",
      headers: { ...headers, "if-match": analyzed.analysis.planHash },
      body: JSON.stringify({ approved: true, statement: analyzed.analysis.invariant.statement }),
    });
    expect(approvedResponse.status).toBe(200);
    const beforeResponse = await fetch(`${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/executions`, {
      method: "POST", headers, body: JSON.stringify({ phase: "before", seed: "custom-e2e" }),
    });
    const before = await beforeResponse.json() as { execution: { passed: boolean; effectKey: string; scenarioResults: unknown[] } };
    expect(before.execution).toMatchObject({ passed: false, effectKey: "lead_42" });
    expect(before.execution.scenarioResults).toHaveLength(4);

    const repairResponse = await fetch(`${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/repairs`, {
      method: "POST", headers, body: JSON.stringify({ mode: "bounded" }),
    });
    expect(repairResponse.status).toBe(201);
    const repaired = await repairResponse.json() as { repair: { id: string } };
    const recheckResponse = await fetch(`${baseUrl}/api/retryproof/v1/repairs/${repaired.repair.id}/recheck`, {
      method: "POST", headers, body: "{}",
    });
    const rechecked = await recheckResponse.json() as { artifact: { id: string }; execution: { passed: boolean; scenarioResults: unknown[] } };
    expect(rechecked.execution.passed).toBe(true);
    expect(rechecked.execution.scenarioResults).toHaveLength(4);

    const download = await fetch(`${baseUrl}/api/retryproof/v1/artifacts/${rechecked.artifact.id}/download`, { headers: { cookie } });
    const archive = unzipSync(new Uint8Array(await download.arrayBuffer()));
    expect(JSON.parse(strFromU8(archive["synthetic-fixture.json"]!))).toEqual({ lead: { id: "lead_42" } });
    expect(JSON.parse(strFromU8(archive["patched-workflow.json"]!)).nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "retryproof_reserve_key" }),
    ]));
  });

  it("returns secret paths without reflecting secret values", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`);
    const cookie = cookieFrom(sessionResponse);
    const session = (await sessionResponse.json()) as { session: { csrfToken: string } };
    const secretValue = "sk-never-reflect-this-value";
    const response = await fetch(`${baseUrl}/api/retryproof/v1/workflows`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        "x-csrf-token": session.session.csrfToken,
      },
      body: JSON.stringify({
        rawWorkflow: JSON.stringify({
          name: "Unsafe",
          nodes: [{ id: "x", name: "x", type: "n8n-nodes-base.httpRequest", parameters: { apiKey: secretValue } }],
          connections: {},
        }),
      }),
    });
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain("$.nodes[0].parameters.apiKey");
    expect(body).not.toContain(secretValue);
  });

  it("rejects an approval statement that is not bound to the analyzed oracle", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`, {
      headers: { "user-agent": "retryproof-invariant-binding-test" },
    });
    const cookie = cookieFrom(sessionResponse);
    const session = (await sessionResponse.json()) as { session: { csrfToken: string } };
    const headers = {
      cookie,
      "content-type": "application/json",
      "x-csrf-token": session.session.csrfToken,
    };
    const imported = await fetch(`${baseUrl}/api/retryproof/v1/workflows`, {
      method: "POST",
      headers,
      body: JSON.stringify({ demo: true }),
    }).then((response) => response.json()) as { workflow: { id: string } };
    const analyzed = await fetch(`${baseUrl}/api/retryproof/v1/workflows/${imported.workflow.id}/analyses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "cached" }),
    }).then((response) => response.json()) as { analysis: { id: string; planHash: string } };

    const response = await fetch(`${baseUrl}/api/retryproof/v1/analyses/${analyzed.analysis.id}/plan`, {
      method: "PATCH",
      headers: { ...headers, "if-match": analyzed.analysis.planHash },
      body: JSON.stringify({ approved: true, statement: "A different, untested claim." }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVARIANT_CHANGED" } });
  });

  it("atomically enforces a mutation limit under parallel requests", async () => {
    const sessionResponse = await fetch(`${baseUrl}/api/retryproof/v1/session`, {
      headers: { "user-agent": "retryproof-atomic-quota-test" },
    });
    const cookie = cookieFrom(sessionResponse);
    const session = (await sessionResponse.json()) as { session: { csrfToken: string } };
    const responses = await Promise.all(Array.from({ length: 65 }, () =>
      fetch(`${baseUrl}/api/retryproof/v1/workflows`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
          "x-csrf-token": session.session.csrfToken,
        },
        body: JSON.stringify({ demo: true }),
      }),
    ));

    expect(responses.filter((response) => response.status === 201)).toHaveLength(60);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(5);
  });

  it("limits fresh anonymous sessions while allowing an existing cookie to reload", async () => {
    const userAgent = `retryproof-admission-test-${Date.now()}`;
    const responses = [];
    for (let index = 0; index < 31; index += 1) {
      responses.push(await fetch(`${baseUrl}/api/retryproof/v1/session`, {
        headers: { "user-agent": userAgent },
      }));
    }
    expect(responses.filter((response) => response.status === 200)).toHaveLength(30);
    const limited = responses.at(-1)!;
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({
      error: { code: "SESSION_RATE_LIMITED" },
    });

    const cookie = cookieFrom(responses[0]);
    const restored = await fetch(`${baseUrl}/api/retryproof/v1/session`, {
      headers: { cookie, "user-agent": userAgent },
    });
    expect(restored.status).toBe(200);
  });
});
