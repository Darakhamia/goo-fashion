// Shim for src/lib/context/auth-context.tsx: a signed-out visitor, as on the site.
const value = {
  user: null,
  isLoggedIn: false,
  isLoading: false,
  login: () => {},
  logout: () => {},
};

export const useAuth = () => value;
