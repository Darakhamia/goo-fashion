/**
 * Renders one or more JSON-LD structured-data blocks as server-rendered
 * <script type="application/ld+json"> tags. Server component (no "use client")
 * so the JSON is present in the initial HTML for crawlers.
 */

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

// Line/paragraph separators — valid in JSON but historically invalid in raw
// script context. Built from char codes so the source stays plain ASCII.
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/**
 * Serialize for embedding inside a <script> tag. JSON.stringify does NOT escape
 * `<`, `>` or `&`, so a value containing "</script>" (e.g. a product name or an
 * AI-generated blog field) would close the tag and allow stored XSS. Escaping
 * these to their \uXXXX form keeps the JSON valid while neutralising the
 * breakout.
 */
function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEP).join("\\u2028")
    .split(PARA_SEP).join("\\u2029");
}

export default function JsonLd({ data }: JsonLdProps) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(block) }}
        />
      ))}
    </>
  );
}
