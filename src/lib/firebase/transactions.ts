import { doc, runTransaction, addDoc, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface TransactionPayload {
  [key: string]: any;
}

export const createInvoiceTransaction = async (payload: TransactionPayload): Promise<void> => {
  // If the invoice is just a draft, we don't need a sequential INV number
  if (payload.status === 'Draft') {
    await addDoc(collection(db, 'sales'), {
      ...payload,
      created_at: new Date().toISOString(),
      date: new Date().toISOString()
    });
    return;
  }

  // For finalized invoices (Pending or Paid), we MUST use a transaction
  // to guarantee a sequential, gapless invoice number.
  const counterRef = doc(db, 'counters', 'invoices');
  const salesRef = collection(db, 'sales');

  try {
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextIdNumber = 1;
      if (counterDoc.exists()) {
        nextIdNumber = (counterDoc.data().current_value || 0) + 1;
      }
      
      // Format to INV-001, INV-042, etc.
      const invoiceId = `INV-${String(nextIdNumber).padStart(3, '0')}`;
      
      // Create a reference for the new sales document
      // We use doc(salesRef) to generate a random Firestore ID, but we 
      // explicitly save the generated INV number inside the document as `invoice_id`
      const newSaleDocRef = doc(salesRef);
      
      transaction.set(newSaleDocRef, {
        ...payload,
        invoice_id: invoiceId,
        created_at: new Date().toISOString(),
        date: new Date().toISOString()
      });
      
      // Update the counter for the next transaction
      transaction.set(counterRef, { current_value: nextIdNumber }, { merge: true });
    });
  } catch (error: any) {
    console.error("Invoice Transaction Failed:", error);
    throw new Error("Failed to generate sequential invoice. Please try again.");
  }
};
