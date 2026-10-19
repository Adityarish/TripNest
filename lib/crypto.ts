import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env, isLocalMode } from "@/lib/env";

function key() {
  if (env.APP_ENCRYPTION_KEY) return Buffer.from(env.APP_ENCRYPTION_KEY, "hex");
  if (isLocalMode) return createHmac("sha256", "tripnest-local-only").update(env.DATABASE_URL).digest();
  throw new Error("APP_ENCRYPTION_KEY is required");
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function signState(value: string) {
  const signature = createHmac("sha256", key()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifyState(signed: string) {
  const separator = signed.lastIndexOf(".");
  if (separator < 1) return null;
  const value = signed.slice(0, separator);
  const actual = Buffer.from(signed.slice(separator + 1));
  const expected = Buffer.from(createHmac("sha256", key()).update(value).digest("base64url"));
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? value : null;
}
