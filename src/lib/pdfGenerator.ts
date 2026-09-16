import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface InvoiceData {
  invoice_id: string;
  date: string;
  client_name: string;
  kra_pin?: string;
  items: Array<{ item: string; qty: number; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
  payment_terms?: string;
  due_date?: string;
  isQuotation?: boolean;
}

export const generateInvoicePDF = async (data: InvoiceData) => {
  const doc = new jsPDF();
  
  // 1. Load logo
  const logoUrl = '/pwa-512x512-cutout.png';
  
  const addLogo = () => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.src = logoUrl;
      img.onload = () => {
        // params: image, format, x, y, width, height
        doc.addImage(img, 'PNG', 14, 10, 40, 40);
        resolve();
      };
      img.onerror = () => {
        console.warn("Logo could not be loaded");
        resolve(); // Continue without logo
      };
    });
  };
  
  await addLogo();

  // 2. Company Details (Center/Right)
  doc.setFontSize(22);
  doc.setTextColor(33, 33, 33);
  doc.text('AQUAGEN', 60, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Email: info@aquagen.com', 60, 28);
  doc.text('Phone: +254 701 313885', 60, 33);
  doc.text('Web: https://www.aquagen.co.ke/', 60, 38);
  
  // 3. Invoice / Quotation Text (Right side)
  doc.setFontSize(16);
  doc.setTextColor(33, 33, 33);
  doc.text(data.isQuotation ? 'QUOTATION' : 'INVOICE', 196, 20, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(data.isQuotation ? 'Quotation No.' : 'Invoice No.', 196, 28, { align: 'right' });
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(data.invoice_id || '#PENDING', 196, 33, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Date', 196, 40, { align: 'right' });
  
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(format(new Date(data.date), 'dd MMM yyyy'), 196, 45, { align: 'right' });
  
  if (data.due_date) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Due Date', 196, 52, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(format(new Date(data.due_date), 'dd MMM yyyy'), 196, 57, { align: 'right' });
  }

  // Draw a horizontal line
  doc.setDrawColor(20, 184, 166); // Teal #14B8A6
  doc.setLineWidth(0.5);
  doc.line(14, 65, 196, 65);

  // 4. Bill To
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(data.isQuotation ? 'QUOTATION FOR' : 'INVOICE FOR', 14, 75);
  
  doc.setFontSize(12);
  doc.setTextColor(33, 33, 33);
  doc.setFont('helvetica', 'bold');
  doc.text(`[+ ${data.client_name}]`, 14, 82);
  doc.setFont('helvetica', 'normal');
  
  if (data.kra_pin) {
    doc.setFontSize(10);
    doc.text(`KRA PIN: ${data.kra_pin}`, 14, 88);
  }

  // 5. Table
  const tableData = data.items.map((item, index) => [
    `${index + 1}. ${item.item}`,
    item.qty,
    item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    (item.qty * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  ]);

  autoTable(doc, {
    startY: 95,
    head: [['Item', 'Qty', 'Unit Price (Ksh)', 'Total (Ksh)']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51], fontStyle: 'bold' }, // slate-200
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  // 6. Totals
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text('Subtotal (Excl. VAT)', 130, finalY);
  doc.setTextColor(51, 51, 51);
  doc.text(`Ksh ${data.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });

  if (data.tax > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text('VAT (16%) Included', 130, finalY + 7);
    doc.setTextColor(51, 51, 51);
    doc.text(`Ksh ${data.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY + 7, { align: 'right' });
  }

  doc.setLineWidth(0.2);
  doc.setDrawColor(200, 200, 200);
  doc.line(130, finalY + 12, 196, finalY + 12);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL (Incl. VAT)', 130, finalY + 20);
  doc.text(`Ksh ${data.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY + 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');

  doc.line(14, finalY + 30, 196, finalY + 30);

  // 7. Footer / Payment Details
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT DETAILS', 14, finalY + 40);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Method', 14, finalY + 47);
  doc.setTextColor(51, 51, 51);
  doc.text('M-Pesa Business Till', 14, finalY + 52);
  
  doc.setTextColor(100, 100, 100);
  doc.text('Till Number', 14, finalY + 60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('3426429', 14, finalY + 67);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Account Name (confirms on payment)', 196, finalY + 47, { align: 'right' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 184, 166); // Teal #14B8A6
  doc.text('AQUAGEN', 196, finalY + 52, { align: 'right' });

  // 8. Bottom Note
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('This is an electronically generated document, no signature is required.', 105, 280, { align: 'center' });

  // Save the PDF
  const safeName = (data.client_name || 'Client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const prefix = data.isQuotation ? 'quotation' : 'invoice';
  doc.save(`${prefix}_${safeName}_${data.invoice_id || 'draft'}.pdf`);
};
