import { useCallback, useEffect, useState } from "react";

export type InstallPlatform = "ios" | "android" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "brisca:install-dismissed";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

interface Detection {
  isMobile: boolean;
  isIOS: boolean;
  isSafariIOS: boolean;
  inApp: boolean;
  standalone: boolean;
  platform: InstallPlatform;
}

function detect(): Detection {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      isMobile: false,
      isIOS: false,
      isSafariIOS: false,
      inApp: false,
      standalone: false,
      platform: "other",
    };
  }

  const ua = navigator.userAgent;
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || iPadOS;
  const isAndroid = /Android/i.test(ua);
  // A narrow touch viewport is a safe fallback for mobile browsers that hide
  // their real user agent, without showing the banner on a desktop window.
  const narrow = window.matchMedia("(max-width: 820px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const isMobile =
    isIOS || isAndroid || /Mobi|Tablet/i.test(ua) || (narrow && coarse);
  const inApp =
    /FBAN|FBAV|Instagram|Line|WhatsApp|Twitter|LinkedIn|Snapchat|Pinterest|MicroMessenger/i.test(
      ua,
    );
  const isSafariIOS = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return {
    isMobile,
    isIOS,
    isSafariIOS,
    inApp,
    standalone,
    platform: isIOS ? "ios" : isAndroid ? "android" : "other",
  };
}

function wasDismissedRecently(): boolean {
  try {
    const timestamp = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_MS;
  } catch {
    return false;
  }
}

export function useInstallPrompt(show: boolean) {
  const [detection] = useState<Detection>(detect);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(detection.standalone);
  const [dismissed, setDismissed] = useState(wasDismissedRecently);
  const [ready, setReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (
      !show ||
      !detection.isMobile ||
      detection.standalone ||
      installed ||
      dismissed
    ) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 1400);
    return () => window.clearTimeout(timer);
  }, [show, detection, installed, dismissed]);

  const visible =
    show &&
    detection.isMobile &&
    !detection.standalone &&
    !installed &&
    !dismissed &&
    ready;

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // private mode
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) {
      setHelpOpen(true);
      return;
    }
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      } else {
        setDismissed(true);
      }
    } catch {
      setHelpOpen(true);
    }
    setDeferred(null);
  }, [deferred]);

  const copyLink = useCallback(async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // In-app browsers often block the clipboard; fall back to a prompt.
      window.prompt("Copia el enlace y ábrelo en Safari o Chrome:", link);
    }
  }, []);

  return {
    visible,
    platform: detection.platform,
    isIOS: detection.isIOS,
    isSafariIOS: detection.isSafariIOS,
    inApp: detection.inApp,
    canNativeInstall: Boolean(deferred),
    helpOpen,
    setHelpOpen,
    install,
    dismiss,
    copyLink,
    copied,
  };
}
