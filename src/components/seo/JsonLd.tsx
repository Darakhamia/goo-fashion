/**
 * Renders one or more JSON-LD structured-data blocks as server-rendered
 * <script type="application/ld+json"> tags. Server component (no "use client")
 * so the JSON is present in the initial HTML for crawlers.
 *
 * `<` is escaped as `\u003c`: product copy comes from scraped retailer pages,
 * and a "</script>" inside it would otherwise end the tag and run whatever
 * follows as page markup. JSON parsers read the escape back as `<`.
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
