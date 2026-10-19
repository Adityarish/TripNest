"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Download, Heart, MoreVertical, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectInstallPlatform, installGuidance, type InstallPlatform } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const HIDDEN_KEY = "tripnest:pwa-install-hidden";
const INSTALLED_KEY = "tripnest:pwa-installed";
let capturedInstallPrompt: BeforeInstallPromptEvent | undefined;

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

export function InstallAppButton() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent>();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => setInstalled(isStandalone());
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      capturedInstallPrompt = event as BeforeInstallPromptEvent;
      setDeferredPrompt(capturedInstallPrompt);
      setInstalled(false);
    };
    const handleInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      capturedInstallPrompt = undefined;
      setInstalled(true);
      setOpen(false);
      setDeferredPrompt(undefined);
    };

    const initializeFrame = requestAnimationFrame(() => {
      setPlatform(detectInstallPlatform({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints }));
      setHidden(localStorage.getItem(HIDDEN_KEY) === "true");
      setInstalled(isStandalone() || localStorage.getItem(INSTALLED_KEY) === "true");
      setDeferredPrompt(capturedInstallPrompt);
      setReady(true);
    });

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    media.addEventListener?.("change", updateDisplayMode);
    return () => {
      cancelAnimationFrame(initializeFrame);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      media.removeEventListener?.("change", updateDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function install() {
    if (!deferredPrompt) return;
    setPending(true);
    setMessage("");
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      capturedInstallPrompt = undefined;
      setDeferredPrompt(undefined);
      setMessage(choice.outcome === "accepted" ? "Installation started." : "Installation was dismissed. You can try again later.");
      if (choice.outcome === "accepted") setOpen(false);
    } finally {
      setPending(false);
    }
  }

  function hideInstallOption() {
    localStorage.setItem(HIDDEN_KEY, "true");
    setHidden(true);
    setOpen(false);
  }

  if (!ready || hidden || installed) return null;
  const guidance = installGuidance[platform];

  return <>
    <Button type="button" variant="ghost" size="sm" onClick={() => { setMessage(""); setOpen(true); }} aria-haspopup="dialog" className="px-2.5 sm:px-3">
      <Download className="size-4" /> <span className="hidden md:inline">Install app</span>
    </Button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="install-app-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[2rem] bg-cream p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <Image src="/icon-192.png" alt="" width="52" height="52" className="size-13 rounded-2xl shadow-sm" />
            <div><p className="eyebrow">TripNest web app</p><h2 id="install-app-title" className="mt-1 font-display text-3xl">Install TripNest</h2></div>
          </div>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" aria-label="Close install instructions" onClick={() => setOpen(false)}><X className="size-5" /></Button>
        </div>

        <p className="mt-5 text-sm leading-6 text-ink/60">Keep your journeys one click away in a standalone window. TripNest will continue using the same secure website, account, and private storage.</p>

        {deferredPrompt ? <div className="mt-6 rounded-2xl border border-sage/25 bg-white p-5">
          <div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage" /><div><h3 className="font-semibold">Ready to install</h3><p className="mt-1 text-xs leading-5 text-ink/55">Your browser supports TripNest installation on this device.</p></div></div>
          <Button type="button" variant="coral" className="mt-4 w-full" disabled={pending} onClick={install}><Download className="size-4" /> {pending ? "Opening browser prompt…" : "Install TripNest"}</Button>
        </div> : <div className="mt-6 rounded-2xl border border-ink/8 bg-white p-5">
          <div className="flex gap-3">{platform === "ios" ? <Share2 className="mt-0.5 size-5 shrink-0 text-coral" /> : platform === "mac-safari" ? <Heart className="mt-0.5 size-5 shrink-0 text-coral" /> : <MoreVertical className="mt-0.5 size-5 shrink-0 text-coral" />}<div><h3 className="font-semibold">{guidance.title}</h3><p className="mt-1 text-xs leading-5 text-ink/55">{guidance.intro}</p></div></div>
          <ol className="mt-4 space-y-3">{guidance.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-5 text-ink/70"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-sand text-[11px] font-bold text-ink/60">{index + 1}</span><span>{step}</span></li>)}</ol>
        </div>}

        {message && <p role="status" className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-ink/70">{message}</p>}
        <div className="mt-5 flex items-center justify-between gap-3"><button type="button" className="text-xs text-ink/40 underline-offset-4 hover:text-ink hover:underline" onClick={hideInstallOption}>Don’t show this option again</button><Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Not now</Button></div>
      </section>
    </div>}
  </>;
}
