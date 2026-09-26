"use client";

import { createContext, useContext } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { coercePlan, type PlanId } from "@/lib/plans";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  plan: PlanId;
  joinedAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  // Opens Clerk's sign-in modal; Clerk's own UI collects the credentials.
  // Any arguments are ignored: the rest parameter only keeps the remaining
  // `login("", "")` call sites compiling until they call `login()`.
  login: (..._ignored: string[]) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  isLoggedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut, openSignIn } = useClerk();

  const user: AuthUser | null =
    isLoaded && clerkUser
      ? {
          id: clerkUser.id,
          name:
            clerkUser.fullName ||
            clerkUser.firstName ||
            clerkUser.emailAddresses[0]?.emailAddress.split("@")[0] ||
            "User",
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          // Plan stored in publicMetadata; defaults to "free" for unsubscribed users.
          plan: coercePlan((clerkUser.publicMetadata as { plan?: unknown }).plan),
          joinedAt: clerkUser.createdAt
            ? new Date(clerkUser.createdAt).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
        }
      : null;

  // Sign-in itself is handled by Clerk's UI components; this opens the Clerk
  // modal for places that need to ask a signed-out visitor to sign in.
  const login = () => {
    openSignIn();
  };

  const logout = () => {
    signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
