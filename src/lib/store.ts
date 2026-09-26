"use client";

// Client-side persistence for V1. All user data lives in localStorage on the
// device; the API routes are stateless. Swap this module for a server-backed
// store when accounts arrive — components only use the functions below.

import { useSyncExternalStore } from "react";
import type { AppState } from "./types";

const KEY = "forrix:v1";

export const EMPTY_STATE: AppState = {
  version: 1,
  profile: null,
  conversations: [],
  memories: [],
  controlRatings: [],
  observations: null,
  nudges: [],
  events: [],
};

let state: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    state = raw ? { ...EMPTY_STATE, ...(JSON.parse(raw) as AppState) } : EMPTY_STATE;
  } catch {
    state = EMPTY_STATE;
  }
  return state;
}

export function getState(): AppState {
  return typeof window === "undefined" ? EMPTY_STATE : load();
}

export function setState(update: (s: AppState) => AppState): AppState {
  state = update(load());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked — keep the in-memory state for this session.
  }
  listeners.forEach((l) => l());
  return state;
}

export function resetState() {
  setState(() => EMPTY_STATE);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => EMPTY_STATE);
}

const noopSubscribe = () => () => {};

// False during SSR and hydration, true once client state is readable. Use it
// to avoid acting on EMPTY_STATE (e.g. redirecting to onboarding) too early.
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
