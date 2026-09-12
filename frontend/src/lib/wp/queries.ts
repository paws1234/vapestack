/**
 * GraphQL documents the storefront sends to WordPress.
 *
 * These mirror docs/headless-contract.md. Keep the two in step: every field here was
 * proved against the live endpoint, and the inline fragment on GlobalProductAttribute
 * is required rather than decorative - without it the term labels are not queryable.
 *
 * Everything inside a document below is GraphQL, not JavaScript, even though it is written in a
 * template literal. Two traps, both paid for:
 *
 * 1. A backtick anywhere inside ends the template literal before the document is closed.
 * 2. GraphQL only knows hash comments. A JavaScript block comment in a document is a syntax
 *    error, and WPGraphQL answers a syntax error with HTTP 500 - which `wpQuery` classifies as
 *    "WordPress is away". Every page served the offline notice while WordPress answered the same
 *    query by hand with a 200.
 */

/** Fragments shared by the catalogue and the single-product query. */
const PRODUCT_FIELDS = `
  fragment ProductFields on Product {
    databaseId
    name
    slug
    description
    shortDescription
    image {
      sourceUrl
      altText
    }
    productCategories {
      nodes {
        name
        slug
      }
    }
    ... on InventoriedProduct {
      stockStatus
    }
    # sku and price are on the concrete product types, not on the Product interface, which is
    # why they need the inline fragments. Probed against the live endpoint: both SimpleProduct
    # and VariableProduct answer sku.
    ... on SimpleProduct {
      sku
      price(format: RAW)
      # A simple product carries its published specifications as custom, non-taxonomy attributes,
      # where label is the human name and options hold the values themselves - unlike a global
      # attribute, whose options are term slugs to look up. Aliased away from the attributes field,
      # which is what the variation selectors are built from, so a read-only spec list and a set of
      # choices can never be confused for one another.
      specs: attributes {
        nodes {
          label
          options
        }
      }
    }
    ... on VariableProduct {
      sku
      attributes {
        nodes {
          name
          label
          options
          ... on GlobalProductAttribute {
            terms {
              nodes {
                name
                slug
              }
            }
          }
        }
      }
      variations(first: 100) {
        nodes {
          databaseId
          sku
          price(format: RAW)
          stockStatus
          image {
            sourceUrl
          }
          attributes {
            nodes {
              name
              value
            }
          }
        }
      }
    }
  }
`;

/**
 * Every product, one page at a time. The app sorts what it needs.
 *
 * Paginated because WordPress caps a connection at 100 nodes: `first: 200` does not fail, it
 * quietly answers with 100. The catalogue is read whole (the ranges, the search index and the
 * shop are all derived from it), so a truncated read is not a partial shop but a wrong one — the
 * ranges would come from whichever hundred arrived, and every product page past them would 404.
 */
export const CATALOGUE_QUERY = `
  ${PRODUCT_FIELDS}
  query Catalogue($first: Int = 100, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...ProductFields
      }
    }
  }
`;

/**
 * One block, and the attributes the renderer draws from.
 *
 * `attributes` is **not** on the `EditorBlock` interface - each block type carries its own - so this
 * is one inline fragment per block `components/blocks/block-content.tsx` has a row for. That is also
 * what makes an unsupported block safe: no fragment matches it, `attributes` simply does not arrive,
 * and the block's `innerBlocks` still do.
 *
 * `innerBlocks` appears three times because a GraphQL document cannot recurse. Three levels is the
 * depth of the deepest thing an editor is likely to build here - a group around columns around a
 * paragraph - and past it a block still arrives with its name and children, so the renderer draws
 * what it can rather than nothing.
 *
 * Three fields are aliased, and none of them for style. `height` is `String!` on a spacer and
 * `String` on an image, which GraphQL refuses to answer under one name - measured, it answers
 * `Fields "attributes" conflict because subfields "height" conflict because they return conflicting
 * types String! and String`. Aliasing `spacerHeight`, `imageWidth` and `imageHeight` fixes the query
 * and also stops one word meaning two things in the reader.
 */
const BLOCK_FIELDS = `
  name
  renderedHtml
  ... on CoreParagraph {
    attributes {
      content
    }
  }
  ... on CoreHeading {
    attributes {
      content
      level
    }
  }
  ... on CoreList {
    attributes {
      ordered
      values
    }
  }
  ... on CoreListItem {
    attributes {
      content
    }
  }
  ... on CoreQuote {
    attributes {
      value
      citation
    }
  }
  ... on CoreSpacer {
    attributes {
      spacerHeight: height
    }
  }
  ... on CoreImage {
    attributes {
      src
      alt
      caption
      href
      imageWidth: width
      imageHeight: height
    }
    mediaDetails {
      width
      height
    }
  }
  ... on CoreShortcode {
    attributes {
      text
    }
  }
  ... on CoreButton {
    attributes {
      text
      url
      linkTarget
    }
  }
`;

/**
 * One page, as the blocks it is made of.
 *
 * The page is asked for by URI rather than by slug: `PageIdType` offers `DATABASE_ID`, `ID` and
 * `URI`, and an unknown URI answers `null` without an error - which is what lets the reader tell "no
 * such page" from "WordPress is not answering".
 */
export const PAGE_BLOCKS_QUERY = `
  query PageBlocks($uri: ID!) {
    page(id: $uri, idType: URI) {
      title
      editorBlocks {
        ${BLOCK_FIELDS}
        innerBlocks {
          ${BLOCK_FIELDS}
          innerBlocks {
            ${BLOCK_FIELDS}
            innerBlocks {
              name
              renderedHtml
              ... on CoreParagraph {
                attributes {
                  content
                }
              }
            }
          }
        }
      }
    }
  }
`;
