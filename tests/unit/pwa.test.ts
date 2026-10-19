import { describe, expect, it } from "vitest";
import { detectInstallPlatform, installGuidance } from "@/lib/pwa";

describe("PWA installation guidance", () => {
  it.each([
    ["iPhone", "iPhone", 5, "ios"],
    ["Mozilla/5.0 (Macintosh) Safari/605.1.15", "MacIntel", 0, "mac-safari"],
    ["Mozilla/5.0 (Linux; Android 15) Chrome/140", "Linux armv8l", 5, "android"],
    ["Mozilla/5.0 (Windows NT 10.0) Edg/140", "Win32", 0, "edge"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/140", "Win32", 0, "chromium"],
  ])("detects %s", (userAgent, platform, maxTouchPoints, expected) => {
    expect(detectInstallPlatform({ userAgent, platform, maxTouchPoints })).toBe(expected);
  });

  it("provides actionable manual steps for every platform", () => {
    for (const guidance of Object.values(installGuidance)) expect(guidance.steps.length).toBeGreaterThanOrEqual(3);
  });
});
