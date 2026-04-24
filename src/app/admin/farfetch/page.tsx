"use client";

import { useState } from "react";
import Image from "next/image";

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
  originalImages: string[];
  sourceUrl: string;
}

const CATEGORIES = [
  "outerwear", "blazers", "tops", "shirts", "knitwear", "bottoms", "jeans",
  "shorts", "skirts", "dresses", "jumpsuits", "swimwear", "footwear", "bags", "accessories",
];

const inputCls = "w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)]";
const labelCls = "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";

export default function FarfetchImportPage() {
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [product, setProduct] = useState<FetchedProduct | null>(null);
  // Editable fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importedId, setImportedId] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError("");
    setProduct(null);
    setImportedId(null);
    setImportError("");

    try {
      const res = await fetch("/api/farfetch/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? "Failed to fetch product.");
        return;
      }
      setProduct(data);
      setName(data.name);
      setBrand(data.brand);
      setCategory(data.category);
      setGender(data.gender ?? "");
      setPrice(String(data.price));
      setCurrency(data.currency ?? "USD");
      setDescription(data.description ?? "");
      setSelectedImage(0);
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async () => {
    if (!product) return;
    setImporting(true);
    setImportError("");

    try {
      const res = await fetch("/api/farfetch/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim(),
          category,
          gender: gender || undefined,
          price: parseFloat(price) || 0,
          currency,
          description: description.trim(),
          imageUrl: product.images[selectedImage] ?? product.imageUrl,
          images: product.images,
          sourceUrl: product.sourceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed.");
        return;
      }
      setImportedId(data.id);
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setUrl("");
    setProduct(null);
    setImportedId(null);
    setFetchError("");
    setImportError("");
  };

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Farfetch Import</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
          Paste a Farfetch product URL to fetch and import it into the catalog
        </p>
      </div>

      {/* URL input */}
      <div className="flex gap-3 items-start">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          placeholder="https://www.farfetch.com/shopping/men/..."
          className={`${inputCls} flex-1`}
          disabled={fetching}
        />
        <button
          onClick={handleFetch}
          disabled={!url.trim() || fetching}
          className="px-6 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs tracking-[0.14em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
        >
          {fetching ? (
            <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Fetching…</>
          ) : "Fetch product"}
        </button>
      </div>

      {fetchError && (
        <p className="text-xs text-red-400">{fetchError}</p>
      )}

      {/* Fetching spinner hint */}
      {fetching && (
        <p className="text-xs text-[var(--foreground-muted)] animate-pulse">
          Fetching from Farfetch and uploading images to storage — takes ~10 seconds…
        </p>
      )}

      {/* Product preview + edit */}
      {product && !importedId && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 border border-[var(--border)] p-6" style={{ background: "var(--background)" }}>

          {/* Images */}
          <div className="space-y-3">
            <div className="relative aspect-[3/4] border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
              {product.images[selectedImage] ? (
                <Image
                  src={product.images[selectedImage]}
                  alt={name}
                  fill
                  className="object-cover"
                  sizes="340px"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--foreground-subtle)] text-xs">No image</div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-1.5">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative aspect-square border overflow-hidden transition-all ${
                      selectedImage === i ? "border-[var(--foreground)]" : "border-[var(--border)] opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image src={img} alt="" fill className="object-cover" sizes="80px" unoptimized />
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-[var(--foreground-subtle)]">
              {product.images.length} image{product.images.length !== 1 ? "s" : ""} uploaded to storage · click to select cover
            </p>
          </div>

          {/* Edit fields */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Product name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Brand</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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
                  {["USD", "EUR", "GBP", "AED", "JPY", "TRY", "RUB"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={`${inputCls} resize-y`}
              />
            </div>

            <div className="pt-2 flex items-center gap-4">
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
              >
                View on Farfetch ↗
              </a>
              <span className="text-[10px] text-[var(--foreground-subtle)]">ID: {product.farfetchId}</span>
            </div>

            {importError && <p className="text-xs text-red-400">{importError}</p>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleImport}
                disabled={!name.trim() || !brand.trim() || importing}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {importing ? (
                  <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Importing…</>
                ) : "Import to catalog"}
              </button>
              <button
                onClick={reset}
                className="border border-[var(--border)] px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {importedId && (
        <div className="border border-emerald-500/30 bg-emerald-500/5 px-5 py-6 flex flex-col items-start gap-4">
          <div>
            <p className="text-emerald-400 font-medium text-sm">Product imported successfully</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">{name} · {brand} · ID: {importedId}</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/admin/products`}
              className="text-xs tracking-[0.12em] uppercase bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-80 transition-opacity"
            >
              Go to Products
            </a>
            <button
              onClick={reset}
              className="text-xs tracking-[0.12em] uppercase border border-[var(--border)] px-4 py-2 text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
