function formatINR(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN");
}

function drawTable(doc, { headers, rows }, options = {}) {
  const {
    startX = 60, startY = 120, colWidths = [], rowHeight = 26,
    headerHeight = 28, maxY = doc.page.height - 60,
    headerFont = "Helvetica-Bold", rowFont = "Helvetica",
    fontSize = 10, cellPaddingX = 8,
  } = options;

  const cols = headers.length;
  const widths =
    colWidths.length === cols ? colWidths :
    Array(cols).fill(Math.floor((doc.page.width - startX * 2) / cols));

  let y = startY;

  function maybeAddPage(nextRowHeight) {
    if (y + nextRowHeight > maxY) {
      doc.addPage();
      y = 60;
    }
  }

  // Header
  doc.font(headerFont).fontSize(fontSize);
  maybeAddPage(headerHeight);
  let x = startX;
  for (let c = 0; c < cols; c++) {
    doc.rect(x, y, widths[c], headerHeight).stroke();
    doc.text(String(headers[c]), x + cellPaddingX, y + 8, {
      width: widths[c] - cellPaddingX * 2,
      ellipsis: true,
    });
    x += widths[c];
  }
  y += headerHeight;

  // Rows
  doc.font(rowFont).fontSize(fontSize);
  rows.forEach((row) => {
    maybeAddPage(rowHeight);
    let x = startX;
    for (let c = 0; c < cols; c++) {
      doc.rect(x, y, widths[c], rowHeight).stroke();
      doc.text(String(row[c] ?? ""), x + cellPaddingX, y + 7, {
        width: widths[c] - cellPaddingX * 2,
        ellipsis: true,
      });
      x += widths[c];
    }
    y += rowHeight;
  });

  return y;
}

module.exports = { formatINR, drawTable };
