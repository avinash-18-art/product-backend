const statusList = [
  "all", 
  "rto", 
  "door_step_exchanged", 
  "delivered", "cancelled",
  "ready_to_ship", 
  "shipped", 
  "supplier_listed_price", 
  "supplier_discounted_price"
];

function parsePrice(value) {
  if (!value) return 0;
  const clean = value.toString().trim().replace(/[^0-9.\-]/g, "");
  return parseFloat(clean) || 0;
}

function getColumnValue(row, possibleNames) {
  const keys = Object.keys(row).map((k) => k.toLowerCase().trim());
  for (let name of possibleNames) {
    const idx = keys.indexOf(name.toLowerCase().trim());
    if (idx !== -1) return row[Object.keys(row)[idx]];
  }
  return 0;
}

function categorizeRows(rows) {
  const categories = {};
  statusList.forEach((status) => (categories[status] = []));
  categories.other = [];

  let totalSupplierListedPrice = 0;
  let totalSupplierDiscountedPrice = 0;
  let sellInMonthProducts = 0;
  let deliveredSupplierDiscountedPriceTotal = 0;
  let totalDoorStepExchanger = 0;

  rows.forEach((row) => {
    const status = (row["Reason for Credit Entry"] || "").toLowerCase().trim();
    categories["all"].push(row);

    const listedPrice = parsePrice(getColumnValue(row, [
      "Supplier Listed Price (Incl. GST + Commission)", 
      "Supplier Listed Price", 
      "Listed Price"
    ]));

    const discountedPrice = parsePrice(getColumnValue(row, [
      "Supplier Discounted Price (Incl GST and Commission)",
      "Supplier Discounted Price (Incl GST and Commision)",
      "Supplier Discounted Price", 
      "Discounted Price",
    ])
);

    totalSupplierListedPrice += listedPrice;
    totalSupplierDiscountedPrice += discountedPrice;

    if (status.includes("delivered")) {
      sellInMonthProducts += 1;
      deliveredSupplierDiscountedPriceTotal += discountedPrice;
    }

    if (status.includes("door_step_exchanged")) {
      totalDoorStepExchanger += 80;
    }

    let matched = false;
    if (status.includes("rto_complete") || 
    status.includes("rto_locked") || 
    status.includes("rto_initiated")
) {
      categories["rto"].push(row);
      matched = true;
    } else {
      statusList.forEach((s) => {
        if (s !== "all" && s !== "rto" && status.includes(s)) {
          categories[s].push(row);
          matched = true;
        }
      });
    }
    if (!matched) categories.other.push(row);
  });

  const totalProfit = deliveredSupplierDiscountedPriceTotal - sellInMonthProducts * 500;
  
  const profitPercent = sellInMonthProducts !== 0
    ? (totalProfit / (sellInMonthProducts * 500)) * 100
    : 0;

  categories.totals = {
    totalSupplierListedPrice,
    totalSupplierDiscountedPrice,
    sellInMonthProducts,
    deliveredSupplierDiscountedPriceTotal,
    totalDoorStepExchanger,
    totalProfit,
    profitPercent: profitPercent.toFixed(2),
  };

  return categories;
}

module.exports = { categorizeRows, parsePrice, getColumnValue };
