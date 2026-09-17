"use client";

import { useState } from "react";
import { useBackdropDismiss } from "@/lib/use-backdrop-dismiss";

export type GenerationStyle = "mannequin" | "flatlay" | "tryon";

/**
 * The "how should this look be photographed" sheet.
 *
 * Lifted out of the builder so the saved page can open the same one rather than
 * a second thing that looks like it. The builder shows it when saving a look;
 * the saved page shows it when replacing a look's photo. The only differences
 * are the title and what the collage option means, so those are props and the
 * rest — including the two-step try-on flow — is shared.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Sheet title. The builder is saving; the saved page is replacing. */
  title: string;
  /**
   * The "no AI photo" option. Its wording differs by caller — saving a collage
   * is not the same sentence as dropping the generated photo for one — and a
   * caller with nothing sensible to offer passes null to hide it.
   */
  collage: { label: string; hint: string } | null;
  onCollage?: () => void;
  onGenerate: (style: GenerationStyle, userPhotoDataUri?: string) => void;
}

/** Downscale a chosen photo before it travels as a data URI. */
export function compressPhoto(file: File, maxPx = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.src = objectUrl;
  });
}

export function StylePicker({ open, onClose, title, collage, onCollage, onGenerate }: Props) {
  const [tryonStep, setTryonStep] = useState(false);
  const [userPhotoDataUri, setUserPhotoDataUri] = useState<string | null>(null);

  const close = () => {
    setTryonStep(false);
    setUserPhotoDataUri(null);
    onClose();
  };

  const backdrop = useBackdropDismiss(close);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      {...backdrop}
    >
      <div className="bg-[var(--background)] shadow-2xl w-full max-w-sm mx-4 animate-scale-in rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          {tryonStep ? (
            <button
              onClick={() => { setTryonStep(false); setUserPhotoDataUri(null); }}
              className="flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M10 6H2M2 6L6 2M2 6L6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase">Back</span>
            </button>
          ) : (
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
              {title}
            </p>
          )}
          <button
            onClick={close}
            aria-label="Close"
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
              <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ── Step 1: Style selection ── */}
        {!tryonStep && (
          <>
            {collage && (
              <>
                <div className="px-5 pt-5 pb-3">
                  <button
                    onClick={() => { close(); onCollage?.(); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-[var(--foreground)] text-[var(--background)] rounded-xl hover:opacity-90 transition-opacity group"
                  >
                    <div className="flex items-center gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" rx="1" />
                        <rect x="14" y="3" width="7" height="7" rx="1" />
                        <rect x="3" y="14" width="7" height="7" rx="1" />
                        <rect x="14" y="14" width="7" height="7" rx="1" />
                      </svg>
                      <div className="text-left">
                        <p className="font-mono text-[10px] tracking-[0.14em] uppercase font-semibold">{collage.label}</p>
                        <p className="font-mono text-[8px] opacity-60 mt-0.5">{collage.hint}</p>
                      </div>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <path d="M2 6H10M10 6L6 2M10 6L6 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <p className="px-5 pb-2 font-mono text-[8px] text-[var(--foreground-subtle)] text-center tracking-[0.1em] uppercase">Or generate with AI</p>
              </>
            )}

            <div className={`px-5 pb-3 grid grid-cols-2 gap-3 ${collage ? "" : "pt-5"}`}>
              {/* Mannequin */}
              <button
                onClick={() => { close(); onGenerate("mannequin"); }}
                className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-colors duration-150 rounded-xl"
              >
                <div className="w-full aspect-square bg-[var(--surface)] rounded-lg flex items-center justify-center text-[var(--foreground)]">
                  <svg width="32" height="48" viewBox="0 0 32 56" fill="none">
                    <ellipse cx="16" cy="6" rx="5" ry="5" fill="currentColor" opacity="0.6" />
                    <rect x="10" y="13" width="12" height="22" rx="2" fill="currentColor" opacity="0.6" />
                    <rect x="4" y="13" width="6" height="16" rx="2" fill="currentColor" opacity="0.45" />
                    <rect x="22" y="13" width="6" height="16" rx="2" fill="currentColor" opacity="0.45" />
                    <rect x="10" y="36" width="5" height="18" rx="2" fill="currentColor" opacity="0.6" />
                    <rect x="17" y="36" width="5" height="18" rx="2" fill="currentColor" opacity="0.6" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)] mb-0.5">Mannequin</p>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">Black studio</p>
                </div>
              </button>

              {/* Flat lay */}
              <button
                onClick={() => { close(); onGenerate("flatlay"); }}
                className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-colors duration-150 rounded-xl"
              >
                <div className="w-full aspect-square bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--foreground)]">
                  <svg width="48" height="36" viewBox="0 0 56 40" fill="none">
                    <rect x="4" y="4" width="20" height="14" rx="2" fill="currentColor" opacity="0.5" />
                    <rect x="32" y="4" width="20" height="14" rx="2" fill="currentColor" opacity="0.4" />
                    <rect x="4" y="24" width="20" height="12" rx="2" fill="currentColor" opacity="0.6" />
                    <rect x="32" y="24" width="20" height="12" rx="2" fill="currentColor" opacity="0.45" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)] mb-0.5">Flat lay</p>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">White studio</p>
                </div>
              </button>
            </div>

            {/* On You — full-width */}
            <div className="px-5 pb-5">
              <button
                onClick={() => setTryonStep(true)}
                className="group w-full flex items-center gap-4 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-colors duration-150 rounded-xl"
              >
                <div className="w-14 h-14 shrink-0 bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                  <svg width="28" height="40" viewBox="0 0 28 48" fill="none">
                    <ellipse cx="14" cy="5" rx="4" ry="4" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M7 12H21L22 28H16L14 44H14L12 28H6L7 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M7 14L2 20M21 14L26 20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)]">On You</p>
                    <span className="font-mono text-[7px] tracking-[0.12em] uppercase px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)]">New</span>
                  </div>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">Upload your photo · AI dresses you</p>
                </div>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0">
                  <path d="M2 6H10M10 6L6 2M10 6L6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <p className="px-5 pb-4 font-mono text-[8px] text-[var(--foreground-subtle)] text-center">
              Product images sent as references · 1K resolution · Nano Banana 2
            </p>
          </>
        )}

        {/* ── Step 2: Photo upload for try-on ── */}
        {tryonStep && (
          <div className="p-5 flex flex-col gap-4">
            <p className="font-mono text-[9px] text-[var(--foreground-muted)] leading-relaxed">
              Upload a full-body photo of yourself in a T-pose on a plain background. The AI will place you in a studio shot wearing the selected outfit.
            </p>

            <label className="relative cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUserPhotoDataUri(await compressPhoto(file));
                }}
              />
              {userPhotoDataUri ? (
                <div className="relative w-full aspect-[3/4] overflow-hidden border border-[var(--foreground)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={userPhotoDataUri} alt="Your photo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                    <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white opacity-0 hover:opacity-100 transition-opacity">Change photo</p>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-[3/4] border border-dashed border-[var(--border-strong)] flex flex-col items-center justify-center gap-3 hover:border-[var(--foreground)] transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--foreground-subtle)]">
                    <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                    Click to upload
                  </p>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)] text-center px-4">
                    Full body · T-pose · plain background
                  </p>
                </div>
              )}
            </label>

            <button
              disabled={!userPhotoDataUri}
              onClick={() => {
                if (!userPhotoDataUri) return;
                const photo = userPhotoDataUri;
                close();
                onGenerate("tryon", photo);
              }}
              className={`w-full h-10 font-mono text-[10px] tracking-[0.18em] uppercase transition-[color,background-color,border-color,opacity] duration-150 ${
                userPhotoDataUri
                  ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                  : "bg-[var(--border)] text-[var(--foreground-subtle)] cursor-not-allowed"
              }`}
            >
              Generate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
