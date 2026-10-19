export type InstallPlatform = "ios" | "android" | "mac-safari" | "edge" | "chromium" | "other";

type NavigatorDetails = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
};

export function detectInstallPlatform({ userAgent, platform, maxTouchPoints }: NavigatorDetails): InstallPlatform {
  const ios = /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(userAgent)) return "android";

  const safari = /Safari/i.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS)/i.test(userAgent);
  if (safari && /Mac/i.test(platform)) return "mac-safari";
  if (/Edg/i.test(userAgent)) return "edge";
  if (/(Chrome|Chromium|CriOS)/i.test(userAgent)) return "chromium";
  return "other";
}

export const installGuidance: Record<InstallPlatform, { title: string; intro: string; steps: string[] }> = {
  ios: {
    title: "Add TripNest to your Home Screen",
    intro: "iPhone and iPad browsers do not allow websites to open the install prompt automatically.",
    steps: ["Open the browser’s Share menu.", "Choose Add to Home Screen.", "Confirm by tapping Add."],
  },
  android: {
    title: "Install TripNest on Android",
    intro: "Use your browser menu if the native install prompt is not currently available.",
    steps: ["Open the browser menu (⋮).", "Choose Install app or Add to Home screen.", "Confirm the installation."],
  },
  "mac-safari": {
    title: "Add TripNest to your Dock",
    intro: "Recent versions of Safari on macOS can save TripNest as a web app.",
    steps: ["Open Safari’s File menu.", "Choose Add to Dock, if available.", "Confirm the app name and select Add."],
  },
  edge: {
    title: "Install TripNest from Edge",
    intro: "You can install TripNest from Edge’s browser controls.",
    steps: ["Open Settings and more (⋯).", "Choose Apps, then Install TripNest.", "Confirm the installation."],
  },
  chromium: {
    title: "Install TripNest from your browser",
    intro: "You can install TripNest from Chrome or another Chromium browser.",
    steps: ["Select the install icon in the address bar, if shown.", "Or open the browser menu and choose Install TripNest.", "Confirm the installation."],
  },
  other: {
    title: "Install TripNest",
    intro: "This browser may not support installed web apps on this device.",
    steps: ["Check the browser menu for Install app or Add to Home Screen.", "On desktop, use a current version of Chrome, Edge, or Safari.", "You can continue using TripNest normally in this browser."],
  },
};
