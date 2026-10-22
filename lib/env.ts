import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRIPNEST_PROVIDER_MODE: z.enum(["local", "clerk-google"]).default(process.env.NODE_ENV === "production" ? "clerk-google" : "local"),
  NEXT_PUBLIC_TRIPNEST_PROVIDER_MODE: z.enum(["local", "clerk-google"]).default(process.env.NODE_ENV === "production" ? "clerk-google" : "local"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgresql://tripnest:tripnest@localhost:5432/tripnest?schema=public"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  ADMIN_CLERK_USER_IDS: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APP_ENCRYPTION_KEY: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^[a-fA-F0-9]{64}$/).optional()),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  MOCK_USER_EMAIL: z.string().email().default("demo@tripnest.local"),
  MOCK_USER_NAME: z.string().default("TripNest Explorer"),
  MOCK_DRIVE_PATH: z.string().default(".tripnest-mock-drive"),
});

export const env = schema.parse(process.env);
export const isLocalMode = env.TRIPNEST_PROVIDER_MODE === "local";
export const googleOAuthRedirectUri = new URL("/api/auth/callback/google", env.NEXT_PUBLIC_APP_URL).toString();

export function assertAuthConfiguration() {
  if (env.TRIPNEST_PROVIDER_MODE !== env.NEXT_PUBLIC_TRIPNEST_PROVIDER_MODE) throw new Error("Server and public provider modes must match");
  if (isLocalMode) return;
  const missing = [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing Clerk configuration: ${missing.join(", ")}`);
}

export function assertProductionConfiguration() {
  assertAuthConfiguration();
  if (isLocalMode || env.NODE_ENV !== "production") return;
  const missing = [
    "CLERK_WEBHOOK_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APP_ENCRYPTION_KEY",
  ].filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
  const localHttp = appUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(appUrl.hostname);
  if (appUrl.protocol !== "https:" && !localHttp) throw new Error("Production APP_URL must use HTTPS outside localhost");
}
