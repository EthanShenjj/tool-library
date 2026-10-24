import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY 必须是 64 位十六进制字符串");
  }
  return Buffer.from(raw, "hex");
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptJson<T>(sealed: string): T {
  const [version, ivRaw, tagRaw, payloadRaw] = sealed.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !payloadRaw) {
    throw new Error("加密数据格式无效");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payloadRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as T;
  } catch {
    throw new Error("凭据无法解密，请检查加密密钥是否发生变化");
  }
}
