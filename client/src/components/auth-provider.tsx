import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { onAuthChange, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, initializeFirebase } from "@/lib/firebase";

// User roles: "user" (regular), "developer" (no payment), "admin" (full access)
export type UserRole = "user" | "developer" | "admin";

function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = parseEmailList(import.meta.env.VITE_ADMIN_EMAILS);
const DEVELOPER_EMAILS = parseEmailList(import.meta.env.VITE_DEVELOPER_EMAILS);

// Function to determine user role based on email
function getUserRole(email: string | null): UserRole {
  if (!email) return "user";
  const lowerEmail = email.toLowerCase();

  if (ADMIN_EMAILS.includes(lowerEmail)) {
    return "admin";
  }
  if (DEVELOPER_EMAILS.includes(lowerEmail)) {
    return "developer";
  }
  return "user";
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userRole: UserRole;
  isAdmin: boolean;
  isDeveloper: boolean;
  hasUnlimitedAccess: boolean; // true for admin or developer
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeFirebase();
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Compute role based on user email
  const userRole = getUserRole(user?.email || null);
  const isAdmin = userRole === "admin";
  const isDeveloper = userRole === "developer";
  const hasUnlimitedAccess = isAdmin || isDeveloper;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        userRole,
        isAdmin,
        isDeveloper,
        hasUnlimitedAccess,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
