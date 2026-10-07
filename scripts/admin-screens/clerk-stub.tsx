"use client";
// Harness-only stand-in for @clerk/nextjs: a signed-in super admin, no network.
import type { ReactNode } from "react";

const user = {
  id: "user_harness_admin",
  fullName: "Dara Admin",
  firstName: "Dara",
  emailAddresses: [{ emailAddress: "admin@example.com" }],
  primaryEmailAddress: { emailAddress: "admin@example.com" },
  publicMetadata: { plan: "pro", isAdmin: true },
  createdAt: new Date("2026-01-10").getTime(),
  imageUrl: "",
  // The public /profile reads and saves the style profile here (scripts/site-screens).
  unsafeMetadata: {},
  update: async () => {},
};

export function ClerkProvider({ children }: { children: ReactNode; publishableKey?: string }) {
  return <>{children}</>;
}
export function useUser() {
  return { user, isLoaded: true, isSignedIn: true };
}
export function useAuth() {
  return { userId: user.id, isLoaded: true, isSignedIn: true, getToken: async () => "harness" };
}
export function useClerk() {
  return { signOut: () => {}, openSignIn: () => {}, openSignUp: () => {} };
}
export function SignedIn({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function SignedOut() {
  return null;
}
export function SignIn() {
  return null;
}
export function SignUp() {
  return null;
}
