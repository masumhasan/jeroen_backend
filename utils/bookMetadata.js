const BOOK_METADATA = {
  1: {
    title: "Lisa kookt koolhydraatarm",
    sku: "LK-LISAKOOKTK-DEF",
  },
  2: {
    title: "Lisa kookt koolhydraatarm 2",
    sku: "LK-LISAKOOKTK-DEF-1287",
  },
  4: {
    title: "Koolhydraatarme Startgids",
    sku: "LK-KOOLHYDRAA-DEF",
  },
  5: {
    title: "Feestdagen Special receptenboek",
    sku: "LK-FEESTDAGEN-DEF",
  },
  6: {
    title: "Lisa bakt koolhydraatarm",
    sku: "LK-LISABAKTKO-DEF",
  },
  7: {
    title: "Lisa kookt Wereldgerechten",
    sku: "LK-LISAKOOKTW-DEF",
  },
};

const getBookMetadata = (bookNumber) => {
  return BOOK_METADATA[bookNumber] || { title: "Unknown Book", sku: "UNKNOWN-SKU" };
};

module.exports = { BOOK_METADATA, getBookMetadata };
