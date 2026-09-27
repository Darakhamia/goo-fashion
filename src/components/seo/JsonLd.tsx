/**
 * Renders one or more JSON-LD structured-data blocks as server-rendered
 * <script type="application/ld+json"> tags. Server component (no "use client")
 * so the JSON is present in the initial HTML for crawlers.
 */

interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * JSON for the inside of a <script> element.
 *
 * `JSON.stringify` leaves `<` alone, and the HTML parser ends a script at the
 * first `</script>` it meets — even inside a JSON string. The blocks carry
 * catalogue and blog text (product names and descriptions come from other
 * shops via the parser), so a title holding `</script><script>…` would run as
 * our page. `<` is the same character to any JSON reader, so the
 * structured data crawlers see does not change.
 */
export function serializeJsonLd(block: Record<string, unknown>): string {
  return JSON.stringify(block).replace(/</g, "\\u003c");
}

export default function JsonLd({ data }: JsonLdProps) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
        />
      ))}
    </>
  );
}
