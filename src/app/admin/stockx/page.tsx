"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { StockXProduct } from "@/lib/server/stockx";

interface SearchResult {
  products: StockXProduct[];
  pagination?: { total: number; pageNumber: number; pageSize: number };
}

interface ImportResult {
  imported: number;
  errors: number;
  results: { title: string; status: "imported" | "error"; error?: string }[];
}

function ProductCard({
  product,
  selected,
  onToggle,
}: {
  product: StockXProduct;
  selected: boolean;
  onToggle: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = `https://images.stockx.com/images/${product.productId}.jpg`;
  const price = product.productAttributes.retailPrice;
  const color =
    product.productAttributes.colorway ?? product.productAttributes.color ?? "";

  return (
    <div
      onClick={onToggle}
      className={`relative cursor-pointer border transition-all ${
        selected
          ? "border-[var(--foreground)] bg-[var(--surface)]"
          : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)]"
      }`}
    >
      <div
        className={`absolute top-2.5 right-2.5 w-4 h-4 border flex items-center justify-center z-10 ${
          selected
            ? "border-[var(--foreground)] bg-[var(--foreground)]"
            : "border-[var(--border-strong)] bg-[var(--background)]"
        }`}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4 7L8 3"
              stroke="var(--background)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="aspect-square bg-[var(--surface)] overflow-hidden">
        {!imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-contain p-3"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect
                x="4" y="4" width="24" height="24" rx="2"
                stroke="var(--foreground-subtle)" strokeWidth="1.2"
              />
              <path
                d="M4 20L11 13L16 18L21 12L28 20"
                stroke="var(--foreground-subtle)" strokeWidth="1.2" strokeLinejoin="round"
              />
              <circle cx="20" cy="11" r="2.5" stroke="var(--foreground-subtle)" strokeWidth="1.2" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] mb-1">
          {product.brand ?? "—"} · {product.productType}
        </p>
        <p className="text-xs text-[var(--foreground)] leading-snug line-clamp-2 mb-2">
          {product.title}
        </p>
        {color && (
          <p className="text-[10px] text-[var(--foreground-subtle)] truncate mb-1">
            {color}
          </p>
        )}
        {price ? (
          <p className="text-xs font-medium text-[var(--foreground)]">${price}</p>
        ) : (
          <p className="text-[10px] text-[var(--foreground-subtle)]">No price</p>
        )}
      </div>
    </div>
  );
}

export default function StockXImportPage() {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oauthError = searchParams.get("stockx_error");
  const justConnected = searchParams.get("stockx_connected") === "1";

  useEffect(() => {
    fetch("/api/stockx/status")
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => setConnected(false));
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    await fetch("/api/stockx/disconnect", { method: "POST" });
    setConnected(false);
    setResults(null);
    setDisconnecting(false);
  };

  const search = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;
      setLoading(true);
      setError(null);
      setImportResult(null);
      setSelected(new Set());
      try {
        const res = await fetch(
          `/api/stockx/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Search failed");
          setResults(null);
        } else {
          setResults(data);
        }
      } catch {
        setError("Network error — could not reach StockX");
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const toggleSelect = (productId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleImport = async () => {
    if (!results || selected.size === 0) return;
    const toImport = results.products.filter((p) => selected.has(p.productId));
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/stockx/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: toImport }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
      } else {
        setImportResult(data);
        setSelected(new Set());
      }
    } catch {
      setError("Network error during import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-sm tracking-[0.2em] uppercase text-[var(--foreground)] mb-1">
          StockX Import
        </h1>
        <p className="text-xs text-[var(--foreground-muted)]">
          Search the StockX catalog and import products into GOO.
        </p>
      </div>

      {/* Connection status */}
      <div className="mb-8 p-4 border border-[var(--border)] bg-[var(--background)]">
        {connected === null ? (
          <p className="text-xs text-[var(--foreground-muted)]">
            Checking connection...
          </p>
        ) : connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-xs text-[var(--foreground)]">
                {justConnected
                  ? "Successfully connected to StockX"
                  : "Connected to StockX"}
              </p>
            </div>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-red-400 transition-colors disabled:opacity-40"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="w-2 h-2 rounded-full bg-[var(--border-strong)]" />
                <p className="text-xs text-[var(--foreground)]">
                  Not connected to StockX
                </p>
              </div>
              {oauthError && (
                <p className="text-[10px] text-red-400 ml-5">
                  Auth error: {oauthError}
                </p>
              )}
            </div>
            <a
              href="/api/stockx/auth"
              className="h-9 px-5 text-[10px] tracking-[0.16em] uppercase bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity flex items-center"
            >
              Connect StockX Account
            </a>
          </div>
        )}
      </div>

      {connected && (
        <>
          <form onSubmit={search} className="flex gap-3 mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search StockX — e.g. Nike Air Force, Balenciaga..."
              className="flex-1 h-10 px-4 text-xs bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--foreground-muted)] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-10 px-6 text-[10px] tracking-[0.16em] uppercase bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          {error && (
            <div className="mb-6 px-4 py-3 border border-red-400/30 bg-red-400/5 text-xs text-red-400">
              {error}
            </div>
          )}

          {importResult && (
            <div className="mb-6 px-4 py-3 border border-[var(--border)] bg-[var(--background)]">
              <p className="text-xs text-[var(--foreground)] mb-2">
                <span className="text-green-500">
                  {importResult.imported} imported
                </span>
                {importResult.errors > 0 && (
                  <span className="text-red-400 ml-3">
                    {importResult.errors} failed
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-1">
                {importResult.results.map((r, i) => (
                  <p key={i} className="text-[10px] text-[var(--foreground-muted)]">
                    {r.status === "imported" ? "✓" : "✗"} {r.title}
                    {r.error && (
                      <span className="text-red-400 ml-2">— {r.error}</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {results && results.products.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)]">
                  {results.products.length} results
                </p>
                <button
                  onClick={() =>
                    setSelected(
                      new Set(results.products.map((p) => p.productId))
                    )
                  }
                  className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Select all
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {selected.size > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="h-9 px-5 text-[10px] tracking-[0.16em] uppercase bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 disabled:opacity-40 transition-opacity"
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selected.size} product${selected.size > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          )}

          {results && results.products.length === 0 && (
            <p className="text-xs text-[var(--foreground-muted)]">
              No products found for &ldquo;{query}&rdquo;.
            </p>
          )}

          {results && results.products.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {results.products.map((product) => (
                <ProductCard
                  key={product.productId}
                  product={product}
                  selected={selected.has(product.productId)}
                  onToggle={() => toggleSelect(product.productId)}
                />
              ))}
            </div>
          )}

          {!results && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg
                width="40" height="40" viewBox="0 0 40 40" fill="none"
                className="mb-4 opacity-20"
              >
                <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M27 27L35 35"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                />
              </svg>
              <p className="text-xs tracking-[0.14em] uppercase text-[var(--foreground-muted)]">
                Search StockX to begin
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
