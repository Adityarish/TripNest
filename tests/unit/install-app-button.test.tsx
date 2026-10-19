// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InstallAppButton } from "@/components/pwa/install-app-button";

const originalUserAgent = navigator.userAgent;
const originalPlatform = navigator.platform;

function setNavigator(userAgent = "Mozilla/5.0 Chrome/140", platform = "Win32", maxTouchPoints = 0) {
  Object.defineProperties(navigator, {
    userAgent: { configurable: true, value: userAgent },
    platform: { configurable: true, value: platform },
    maxTouchPoints: { configurable: true, value: maxTouchPoints },
    standalone: { configurable: true, value: false },
  });
}

beforeEach(() => {
  localStorage.clear();
  setNavigator();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
  cleanup();
  Object.defineProperties(navigator, {
    userAgent: { configurable: true, value: originalUserAgent },
    platform: { configurable: true, value: originalPlatform },
  });
  vi.unstubAllGlobals();
});

describe("InstallAppButton", () => {
  it("invokes the browser-owned installation prompt when available", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    render(<InstallAppButton />);
    await screen.findByRole("button", { name: /install app/i });

    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
    fireEvent.click(screen.getByRole("button", { name: /install app/i }));
    fireEvent.click(await screen.findByRole("button", { name: /install tripnest/i }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    expect(await screen.findByText(/installation was dismissed/i)).toBeTruthy();
  });

  it("shows iOS Home Screen instructions instead of a fake install prompt", async () => {
    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1", "iPhone", 5);
    render(<InstallAppButton />);
    fireEvent.click(await screen.findByRole("button", { name: /install app/i }));

    expect(await screen.findByText(/add tripnest to your home screen/i)).toBeTruthy();
    expect(screen.getByText(/open the browser’s share menu/i)).toBeTruthy();
  });

  it("hides installation controls after the appinstalled event", async () => {
    render(<InstallAppButton />);
    await screen.findByRole("button", { name: /install app/i });
    window.dispatchEvent(new Event("appinstalled"));

    await waitFor(() => expect(screen.queryByRole("button", { name: /install app/i })).toBeNull());
    expect(localStorage.getItem("tripnest:pwa-installed")).toBe("true");
  });
});
