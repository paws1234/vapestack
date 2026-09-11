/**
 * A `<script type="application/ld+json">` block.
 *
 * The payload is serialised here rather than at each call site because one detail matters: a
 * `</script>` anywhere inside a string would end the element early and dump the rest of the JSON
 * into the document as markup. Escaping every `<` as `\u003c` is valid JSON, parses back to the
 * same string, and makes that impossible.
 *
 * @param props.data Structured data, as the schema.org shape it will be serialised from.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
