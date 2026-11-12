import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Tests always exercise the offline demo path so they never touch the live
// Supabase project. Vitest's MODE is "test", which CONFIG also treats as demo.
vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
