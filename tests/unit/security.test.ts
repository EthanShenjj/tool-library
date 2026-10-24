import { afterEach, describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "@/lib/security";

const originalKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

afterEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = originalKey;
});

describe("credential encryption", () => {
  it("round-trips JSON without placing plaintext in the envelope", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "11".repeat(32);
    const sealed = encryptJson({ token: "sensitive-token", email: "team@example.com" });
    expect(sealed).not.toContain("sensitive-token");
    expect(decryptJson(sealed)).toEqual({ token: "sensitive-token", email: "team@example.com" });
  });

  it("detects tampering", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "22".repeat(32);
    const sealed = encryptJson({ token: "secret" });
    expect(() => decryptJson(`${sealed.slice(0, -2)}aa`)).toThrow("凭据无法解密");
  });

  it("requires a 32-byte key", () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = "short";
    expect(() => encryptJson({ ok: true })).toThrow("64 位十六进制");
  });
});
