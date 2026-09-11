/**
 * GraphQL documents the storefront sends to WordPress.
 *
 * These mirror docs/headless-contract.md. Keep the two in step: every field here was
 * proved against the live endpoint, and the inline fragment on GlobalProductAttribute
 * is required rather than decorative - without it the term labels are not queryable.
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
    ... on SimpleProduct {
      price(format: RAW)
    }
    ... on VariableProduct {
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
