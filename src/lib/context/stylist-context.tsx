"use client";

import { createContext, useContext, useState } from "react";

interface StylistCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const StylistContext = createContext<StylistCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function StylistProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <StylistContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen(v => !v),
      }}
    >
      {children}
    </StylistContext.Provider>
  );
}

export const useStylist = () => useContext(StylistContext);
