import PDFDocument from 'pdfkit';

/** Formats nonnegative integer cents as a CAD amount, for example 272800 → "$2,728.00". */
export function formatCad(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('Amount must be nonnegative integer cents.');
  const dollars = Math.floor(cents / 100).toLocaleString('en-US');
  return `$${dollars}.${String(cents % 100).padStart(2, '0')}`;
}

function formatPaidAt(iso) {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return `${day}, ${date.toISOString().slice(11, 16)} UTC`;
}

/** Builds the receipt text from the stored invoice. The PDF only lays out these values. */
export function buildReceipt(invoice) {
  if (invoice.status !== 'paid' || !invoice.paidAt) throw new Error('Receipts are issued only for paid invoices.');
  return {
    title: 'Payment receipt',
    invoiceNumber: invoice.invoiceNumber,
    sellerName: invoice.sellerName,
    customerName: invoice.customerName,
    paidAt: formatPaidAt(invoice.paidAt),
    status: 'PAID',
    items: invoice.items.map(item => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: formatCad(item.unitPriceCents),
      lineTotal: formatCad(item.lineTotalCents)
    })),
    subtotal: formatCad(invoice.subtotalCents),
    taxLabel: `Tax (${invoice.taxRateBps / 100}%)`,
    tax: formatCad(invoice.taxCents),
    total: `${formatCad(invoice.totalCents)} ${invoice.currency}`,
    note: `Charged in ${invoice.currency}. Amounts are taken from the stored invoice.`
  };
}

const columns = { description: 50, quantity: 330, unitPrice: 390, lineTotal: 470, end: 545 };

function drawItemHeader(doc, y) {
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Description', columns.description, y);
  doc.text('Qty', columns.quantity, y, { width: 50, align: 'right' });
  doc.text('Unit price', columns.unitPrice, y, { width: 70, align: 'right' });
  doc.text('Amount', columns.lineTotal, y, { width: 75, align: 'right' });
  doc.moveTo(columns.description, y + 14).lineTo(columns.end, y + 14).stroke();
  doc.font('Helvetica');
  return y + 20;
}

/** Renders a paid invoice receipt and resolves with the PDF bytes. */
export function renderReceiptPdf(invoice) {
  const receipt = buildReceipt(invoice);
  const doc = new PDFDocument({
    size: 'LETTER', margin: 50,
    info: { Title: `Receipt ${receipt.invoiceNumber}`, Author: receipt.sellerName, CreationDate: new Date(invoice.paidAt) }
  });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(20).text(receipt.title, 50, 50);
  doc.font('Helvetica').fontSize(11).moveDown(0.5);
  doc.text(`Invoice: ${receipt.invoiceNumber}`);
  doc.text(`Seller: ${receipt.sellerName}`);
  doc.text(`Customer: ${receipt.customerName}`);
  doc.text(`Payment date: ${receipt.paidAt}`);
  doc.font('Helvetica-Bold').text(`Status: ${receipt.status}`);
  doc.moveDown();

  const bottom = doc.page.height - doc.page.margins.bottom;
  let y = drawItemHeader(doc, doc.y);
  doc.fontSize(10);
  for (const item of receipt.items) {
    const height = Math.max(doc.heightOfString(item.description, { width: 270 }), 12) + 6;
    if (y + height > bottom) {
      doc.addPage();
      y = drawItemHeader(doc, doc.page.margins.top);
      doc.fontSize(10);
    }
    doc.text(item.description, columns.description, y, { width: 270 });
    doc.text(item.quantity, columns.quantity, y, { width: 50, align: 'right' });
    doc.text(item.unitPrice, columns.unitPrice, y, { width: 70, align: 'right' });
    doc.text(item.lineTotal, columns.lineTotal, y, { width: 75, align: 'right' });
    y += height;
  }

  if (y + 90 > bottom) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  doc.moveTo(columns.unitPrice, y).lineTo(columns.end, y).stroke();
  y += 8;
  const totalRow = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10);
    doc.text(label, columns.quantity - 30, y, { width: 150, align: 'right' });
    doc.text(value, columns.lineTotal - 20, y, { width: 95, align: 'right' });
    y += bold ? 18 : 15;
  };
  totalRow('Subtotal', receipt.subtotal);
  totalRow(receipt.taxLabel, receipt.tax);
  totalRow('Total paid', receipt.total, true);

  doc.font('Helvetica').fontSize(9).text(receipt.note, columns.description, y + 12, { width: 495 });
  doc.end();
  return done;
}
