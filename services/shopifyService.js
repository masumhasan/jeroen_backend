const SHOPIFY_STORE = (process.env.SHOPIFY_STORE || '').trim();
const SHOPIFY_ADMIN_ACCESS_TOKEN = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '').trim();
const SHOPIFY_API_VERSION = (process.env.SHOPIFY_API_VERSION || '2025-10').trim();

const GRAPHQL_QUERY = `
  query OrdersByEmail($query: String!) {
    orders(first: 250, query: $query) {
      edges {
        node {
          cancelledAt
          lineItems(first: 50) {
            edges {
              node { sku }
            }
          }
        }
      }
    }
  }
`;

/**
 * Returns the set of unique SKUs purchased by the given email address.
 * Only non-cancelled orders are counted.
 */
async function getBookSkusByEmail(email) {
  const url = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { query: `email:${email.trim().toLowerCase()}` },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  const skuSet = new Set();
  for (const { node: order } of json.data.orders.edges) {
    if (order.cancelledAt) continue;
    for (const { node: item } of order.lineItems.edges) {
      if (item.sku) skuSet.add(item.sku);
    }
  }

  return Array.from(skuSet);
}

module.exports = { getBookSkusByEmail };
