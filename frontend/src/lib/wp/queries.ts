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

/** Every product, in one page. The app sorts what it needs. */
export const CATALOGUE_QUERY = `
  ${PRODUCT_FIELDS}
  query Catalogue($first: Int = 50) {
    products(first: $first) {
      nodes {
        ...ProductFields
      }
    }
  }
`;
