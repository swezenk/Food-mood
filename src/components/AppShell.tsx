"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppState, useHydrated } from "@/lib/store";
import TabBar from "./TabBar";

// Routes that render full-screen, without the tab bar.
const FULLSCREEN = ["/onboarding", "/chat", "/checkin"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname.startsWith("/onboarding");

  useEffect(() => {
    if (hydrated && !state.profile && !onboarding) router.replace("/onboarding");
  }, [hydrated, state.profile, onboarding, router]);

  if (!hydrated || (!state.profile && !onboarding)) return <div className="app" />;

  const fullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));
  return (
    <div className="app">
      {children}
      {!fullscreen && <TabBar />}
    </div>
  );
}
