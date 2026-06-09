/**
 * Renders one or more JSON-LD structured-data blocks as server-rendered
 * <script type="application/ld+json"> tags. Server component (no "use client")
 * so the JSON is present in the initial HTML for crawlers.
 */

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

export default function JsonLd({ data }: JsonLdProps) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
