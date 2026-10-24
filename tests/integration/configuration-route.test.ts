import { afterEach, describe, expect, it } from "vitest";
import { GET as credentialStatus } from "@/app/api/google/credentials/route";
import { GET as oauthStart } from "@/app/api/google/oauth/start/route";

const original = {
  database: process.env.DATABASE_URL,
  key: process.env.CREDENTIALS_ENCRYPTION_KEY,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
};

afterEach(() => {
  process.env.DATABASE_URL = original.database;
  process.env.CREDENTIALS_ENCRYPTION_KEY = original.key;
  process.env.GOOGLE_CLIENT_ID = original.clientId;
  process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
});

describe("configuration-safe routes", () => {
  it("reports an unconfigured database without crashing", async () => {
    delete process.env.DATABASE_URL;
    const response = await credentialStatus();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, data: { databaseConfigured: false, credentials: [] } });
  });

  it("does not start OAuth without server secrets", async () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await oauthStart();
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
  });
});
