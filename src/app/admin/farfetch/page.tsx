"use client";

import { useState } from "react";
import Image from "next/image";
import type { FarfetchListItem } from "@/app/api/farfetch/search/route";

interface FetchedProduct {
  farfetchId: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  gender?: string;
  category: string;
  description: string;
  imageUrl: string;
  images: string[];
  sourceUrl: string;
}

const CATEGORIES = [
  "outerwear","blazers","tops","shirts","knitwear","bottoms","jeans",
  "shorts","skirts","dresses","jumpsuits","swimwear","footwear","bags","accessories",
];

const inputCls = "w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)]";
const labelCls = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

type Tab = "search" | "url";

export default function FarfetchImportPage() {
  const [tab, setTab] = useState<Tab>("search");

  // ── Search tab ──
  const [query, setQuery] = useState("");
  const [genderSearch, setGenderSearch] = useState("men");
  const [searchPage, setSearchPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<(FarfetchListItem & { category: string })[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ imported: number; errors: number } | null>(null);

  // ── URL tab ──
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [product, setProduct] = useState<FetchedProduct | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importedId, setImportedId] = useState<string | null>(null);

  // ── Search ──
  const handleSearch = async (page = 1) => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setBulkResult(null);
    if (page === 1) { setSearchResults([]); setSelected(new Set()); }
    setSearchPage(page);
    try {
      const res = await fetch(`/api/farfetch/search?q=${encodeURIComponent(query)}&gender=${genderSearch}&page=${page}`);
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error ?? "Search failed"); return; }
      if (page === 1) setSearchResults(data.items ?? []);
      else setSearchResults((prev) => [...prev, ...(data.items ?? [])]);
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(searchResults.map((r) => r.id)));
  const clearAll = () => setSelected(new Set());

  const handleBulkImport = async () => {
    const items = searchResults.filter((r) => selected.has(r.id));
    if (!items.length) return;
    setBulkImporting(true);
    setBulkResult(null);
    let imported = 0, errors = 0;

    for (const item of items) {
      try {
        const res = await fetch("/api/farfetch/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            brand: item.brand,
            category: item.category,
            gender: item.gender?.toLowerCase().includes("men") ? "men" : item.gender?.toLowerCase().includes("women") ? "women" : undefined,
            price: item.price,
            currency: item.currency,
            description: "",
            imageUrl: item.imageUrl,
            images: item.imageUrl ? [item.imageUrl] : [],
            sourceUrl: item.url,
            skipImageUpload: true, // images will be uploaded on first product view
          }),
        });
        if (res.ok) imported++; else errors++;
      } catch { errors++; }
    }
    setBulkImporting(false);
    setBulkResult({ imported, errors });
    setSelected(new Set());
  };

  // ── URL fetch ──
  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError("");
    setProduct(null);
    setImportedId(null);
    try {
      const res = await fetch("/api/farfetch/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error ?? "Failed to fetch product."); return; }
      setProduct(data);
      setName(data.name); setBrand(data.brand); setCategory(data.category);
      setGender(data.gender ?? ""); setPrice(String(data.price));
      setCurrency(data.currency ?? "GBP"); setDescription(data.description ?? "");
      setSelectedImage(0);
    } finally { setFetching(false); }
  };

  const handleImport = async () => {
    if (!product) return;
    setImporting(true); setImportError("");
    try {
      const res = await fetch("/api/farfetch/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), brand: brand.trim(), category,
          gender: gender || undefined, price: parseFloat(price) || 0, currency,
          description: description.trim(),
          imageUrl: product.images[selectedImage] ?? product.imageUrl,
          images: product.images, sourceUrl: product.sourceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Import failed."); return; }
      setImportedId(data.id);
    } finally { setImporting(false); }
  };

  const reset = () => {
    setUrl(""); setProduct(null); setImportedId(null);
    setFetchError(""); setImportError("");
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Farfetch Import</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            Scrapes directly from Farfetch — no third-party API needed
          </p>
        </div>
      </div>

      {/* Setup banner */}
      <div className="flex items-start gap-3 px-4 py-3 border border-amber-400/30 bg-amber-400/5 text-xs">
        <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
        <div>
          <span className="text-amber-400 font-medium">Требуется SCRAPER_API_KEY</span>
          <span className="text-[var(--foreground-muted)] ml-2">
            Farfetch блокирует прямые запросы (Cloudflare). Зарегистрируйся на{" "}
            <a href="https://www.scraperapi.com" target="_blank" rel="noreferrer" className="underline">scraperapi.com</a>
            {" "}(бесплатно 1000 запросов/мес), добавь ключ как{" "}
            <code className="bg-[var(--surface)] px-1">SCRAPER_API_KEY</code> в переменные окружения.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        {([["search", "Search catalog"], ["url", "Single product URL"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-xs tracking-[0.12em] uppercase border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-[var(--foreground)] text-[var(--foreground)]"
                : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search tab ── */}
      {tab === "search" && (
        <div className="space-y-5">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className={labelCls}>Brand or keyword</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(1)}
                placeholder="Balenciaga, Toteme, oversized coat…"
                className={inputCls}
              />
            </div>
            <div className="w-32">
              <label className={labelCls}>Gender</label>
              <select value={genderSearch} onChange={(e) => setGenderSearch(e.target.value)} className={inputCls}>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>
            <button
              onClick={() => handleSearch(1)}
              disabled={!query.trim() || searching}
              className="px-6 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
            >
              {searching
                ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Searching…</>
                : "Search"}
            </button>
          </div>

          {searchError && <p className="text-xs text-red-400">{searchError}</p>}

          {searchResults.length > 0 && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--foreground-muted)]">
                    {searchResults.length} results · {selected.size} selected
                  </span>
                  <button onClick={selectAll} className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">Select all</button>
                  {selected.size > 0 && <button onClick={clearAll} className="text-[10px] uppercase tracking-[0.1em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">Clear</button>}
                </div>
                {selected.size > 0 && (
                  <button
                    onClick={handleBulkImport}
                    disabled={bulkImporting}
                    className="px-5 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2"
                  >
                    {bulkImporting
                      ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Importing…</>
                      : `Import ${selected.size} product${selected.size !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>

              {bulkResult && (
                <div className="px-4 py-3 border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-400">
                  Imported {bulkResult.imported} products{bulkResult.errors > 0 ? ` · ${bulkResult.errors} failed` : ""}.
                </div>
              )}

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {searchResults.map((item) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`relative cursor-pointer border transition-all ${
                        isSelected ? "border-[var(--foreground)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`absolute top-2 right-2 z-10 w-5 h-5 flex items-center justify-center border transition-colors ${
                        isSelected ? "bg-[var(--foreground)] border-[var(--foreground)]" : "bg-[var(--background)]/80 border-[var(--border)]"
                      }`}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="var(--background)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Image */}
                      <div className="relative aspect-[3/4] bg-[var(--surface)] overflow-hidden">
                        {item.imageUrl ? (
                          <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="220px" unoptimized />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[var(--foreground-subtle)] text-xs">No image</div>
                        )}
                      </div>

                      <div className="p-2">
                        <p className="text-[10px] text-[var(--foreground-muted)] uppercase tracking-wide truncate">{item.brand}</p>
                        <p className="text-xs text-[var(--foreground)] leading-snug mt-0.5 line-clamp-2">{item.name}</p>
                        <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                          {item.currency} {item.price}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{item.category}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => handleSearch(searchPage + 1)}
                  disabled={searching}
                  className="border border-[var(--border)] px-6 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors disabled:opacity-40"
                >
                  {searching ? "Loading…" : "Load more"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── URL tab ── */}
      {tab === "url" && (
        <div className="space-y-5">
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="https://www.farfetch.com/uk/shopping/men/..."
              className={`${inputCls} flex-1`}
              disabled={fetching}
            />
            <button
              onClick={handleFetch}
              disabled={!url.trim() || fetching}
              className="px-6 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2 shrink-0"
            >
              {fetching
                ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Fetching…</>
                : "Fetch product"}
            </button>
          </div>

          {fetchError && <p className="text-xs text-red-400">{fetchError}</p>}
          {fetching && <p className="text-xs text-[var(--foreground-muted)] animate-pulse">Reading product page and uploading images…</p>}

          {product && !importedId && (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
              {/* Images */}
              <div className="space-y-2">
                <div className="relative aspect-[3/4] border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                  {product.images[selectedImage] ? (
                    <Image src={product.images[selectedImage]} alt={name} fill className="object-cover" sizes="300px" unoptimized />
                  ) : <div className="absolute inset-0 flex items-center justify-center text-[var(--foreground-subtle)] text-xs">No image</div>}
                </div>
                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-1">
                    {product.images.map((img, i) => (
                      <button key={i} onClick={() => setSelectedImage(i)}
                        className={`relative aspect-square border overflow-hidden transition-all ${selectedImage === i ? "border-[var(--foreground)]" : "border-[var(--border)] opacity-50 hover:opacity-100"}`}>
                        <Image src={img} alt="" fill className="object-cover" sizes="70px" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Brand</label>
                    <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Price</label>
                    <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                      {["GBP","USD","EUR","AED","JPY","TRY","RUB"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                      <option value="">Unisex</option>
                      <option value="women">Women</option>
                      <option value="men">Men</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-y`} />
                </div>
                {importError && <p className="text-xs text-red-400">{importError}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={handleImport} disabled={!name.trim() || importing}
                    className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.14em] uppercase hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
                    {importing ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Importing…</> : "Import to catalog"}
                  </button>
                  <button onClick={reset} className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors">Clear</button>
                </div>
              </div>
            </div>
          )}

          {importedId && (
            <div className="border border-emerald-500/30 bg-emerald-500/5 px-5 py-5 flex flex-col gap-3">
              <p className="text-emerald-400 text-sm font-medium">Imported — {name} · {brand}</p>
              <div className="flex gap-3">
                <a href="/admin/products" className="text-xs tracking-[0.12em] uppercase bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-80 transition-opacity">Go to Products</a>
                <button onClick={reset} className="text-xs tracking-[0.12em] uppercase border border-[var(--border)] px-4 py-2 hover:bg-[var(--surface)] transition-colors">Import another</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
