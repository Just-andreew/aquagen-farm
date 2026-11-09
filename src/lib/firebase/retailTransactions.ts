import { doc, runTransaction, collection } from 'firebase/firestore';
import { db } from '../firebase';

export interface RetailLineItem {
  item_type: 'raw_packet' | 'fried_fish';
  ref_id: string;
  label: string;
  weight_kg?: number;
  price_group_name?: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  cogs: number;
}

export interface DeliveryInput {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  courier_name: string;
  courier_phone: string;
  delivery_fee_charged: number;
  courier_payout: number;
}

export interface ExecuteRetailSalePayload {
  branch_id: string;
  shift_date_key: string;
  seller_id: string;
  seller_name: string;
  payment_method: 'Cash' | 'M-Pesa';
  line_items: RetailLineItem[];
  delivery?: DeliveryInput;
  client_name?: string;
}

export interface ConversionOutputItem {
  group_id: string;
  group_name: string;
  unit_price: number;
  unit_cost_estimate: number;
  count_produced: number;
}

export interface ConvertRawToFriedPayload {
  branch_id: string;
  raw_packet_ids: string[];
  outputs: ConversionOutputItem[];
  converted_by_id: string;
  converted_by_name: string;
  notes?: string;
}

export interface CloseShiftPayload {
  branch_id: string;
  date_key: string;
  system_cash_total: number;
  system_mpesa_total: number;
  system_total_revenue: number;
  declared_cash: number;
  declared_mpesa: number;
  transaction_count: number;
  closed_by_id: string;
  closed_by_name: string;
  notes?: string;
}

const NOTIFY_SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

const triggerServerNotification = async (endpoint: string, body: Record<string, any>) => {
  if (!NOTIFY_SERVER_URL) return;
  try {
    await fetch(`${NOTIFY_SERVER_URL.replace(/\/$/, '')}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('Non-blocking backend notification skipped:', err);
  }
};

export const executeRetailSaleTransaction = async (
  payload: ExecuteRetailSalePayload
): Promise<{ saleId: string; invoiceId: string; deliveryId?: string }> => {
  const counterRef = doc(db, 'counters', 'invoices');
  const salesCol = collection(db, 'sales');
  const deliveriesCol = collection(db, 'retail_deliveries');
  const historyCol = collection(db, 'retail_inventory_history');

  const rawItems = payload.line_items.filter((i) => i.item_type === 'raw_packet');
  const friedItems = payload.line_items.filter((i) => i.item_type === 'fried_fish');

  const result = await runTransaction(db, async (tx) => {
    // 1. Read all required documents first (Firestore transaction rule: all reads before writes)
    const counterSnap = await tx.get(counterRef);

    const rawRefs = rawItems.map((item) => doc(db, 'retail_raw_packets', item.ref_id));
    const rawSnaps = await Promise.all(rawRefs.map((r) => tx.get(r)));

    const friedRefs = friedItems.map((item) => doc(db, 'retail_fried_stock', item.ref_id));
    const friedSnaps = await Promise.all(friedRefs.map((r) => tx.get(r)));

    // 2. Validate Raw Packets availability
    rawSnaps.forEach((snap, idx) => {
      if (!snap.exists()) {
        throw new Error(`Raw packet "${rawItems[idx].label}" no longer exists.`);
      }
      const data = snap.data();
      if (data.status !== 'available') {
        throw new Error(`Raw packet "${rawItems[idx].label}" is already ${data.status}.`);
      }
    });

    // 3. Validate Fried Fish stock quantities
    friedSnaps.forEach((snap, idx) => {
      if (!snap.exists()) {
        throw new Error(`Fried fish group "${friedItems[idx].label}" not found.`);
      }
      const data = snap.data();
      const available = Number(data.quantity_available) || 0;
      if (available < friedItems[idx].qty) {
        throw new Error(
          `Insufficient stock for ${friedItems[idx].label}. Available: ${available}, Requested: ${friedItems[idx].qty}`
        );
      }
    });

    // 4. Generate sequential invoice number
    let nextIdNumber = 1;
    if (counterSnap.exists()) {
      nextIdNumber = (Number(counterSnap.data().current_value) || 0) + 1;
    }
    const invoiceId = `INV-${String(nextIdNumber).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const newSaleRef = doc(salesCol);
    const newDeliveryRef = payload.delivery ? doc(deliveriesCol) : null;

    // 5. Compute financial totals
    const itemsSubtotal = payload.line_items.reduce((sum, i) => sum + i.subtotal, 0);
    const itemsCogs = payload.line_items.reduce((sum, i) => sum + i.cogs, 0);
    const deliveryFee = payload.delivery ? Number(payload.delivery.delivery_fee_charged) || 0 : 0;
    const courierPayout = payload.delivery ? Number(payload.delivery.courier_payout) || 0 : 0;

    const totalRevenue = itemsSubtotal + deliveryFee;
    const totalCogs = itemsCogs + courierPayout;
    const grossMargin = totalRevenue - totalCogs;

    const totalQty = payload.line_items.reduce((sum, i) => sum + i.qty, 0);
    const summaryCategory =
      rawItems.length > 0 && friedItems.length > 0
        ? 'Retail Mixed Fish (Raw & Fried)'
        : rawItems.length > 0
        ? 'Retail Raw Fish'
        : 'Retail Fried Fish';

    // 6. Update Raw Packets to 'sold'
    rawSnaps.forEach((snap, idx) => {
      tx.update(rawRefs[idx], {
        status: 'sold',
        sold_sale_id: newSaleRef.id,
        sold_invoice_id: invoiceId,
        sold_at: nowIso,
      });

      const histRef = doc(historyCol);
      tx.set(histRef, {
        branch_id: payload.branch_id,
        item_type: 'raw_packet',
        item_id: rawRefs[idx].id,
        item_label: rawItems[idx].label,
        change_qty_or_kg: -(rawItems[idx].weight_kg || 1),
        reason: `POS Sale (${invoiceId})`,
        changed_by_name: payload.seller_name,
        timestamp: nowIso,
      });
    });

    // 7. Decrement Fried Fish Stock
    friedSnaps.forEach((snap, idx) => {
      const currentQty = Number(snap.data()?.quantity_available) || 0;
      const newQty = Math.max(0, currentQty - friedItems[idx].qty);

      tx.update(friedRefs[idx], {
        quantity_available: newQty,
        last_updated: nowIso,
        updated_by: payload.seller_name,
      });

      const histRef = doc(historyCol);
      tx.set(histRef, {
        branch_id: payload.branch_id,
        item_type: 'fried_fish',
        item_id: friedRefs[idx].id,
        item_label: friedItems[idx].label,
        change_qty_or_kg: -friedItems[idx].qty,
        reason: `POS Sale (${invoiceId})`,
        changed_by_name: payload.seller_name,
        timestamp: nowIso,
      });
    });

    // 8. Write unified Sale document
    tx.set(newSaleRef, {
      invoice_id: invoiceId,
      type: 'RETAIL_POS',
      branch_id: payload.branch_id,
      shift_date_key: payload.shift_date_key,
      seller_id: payload.seller_id,
      seller_name: payload.seller_name,
      user_id: payload.seller_id,
      category: summaryCategory,
      quantity: totalQty,
      line_items: payload.line_items,
      items: payload.line_items.map((li) => ({
        item: li.label,
        qty: li.qty,
        price: li.unit_price,
      })),
      subtotal: itemsSubtotal,
      delivery_fee_charged: deliveryFee,
      courier_payout: courierPayout,
      amount: totalRevenue,
      total: totalRevenue,
      cogs_total: totalCogs,
      gross_margin: grossMargin,
      payment_method: payload.payment_method,
      status: 'Paid',
      is_delivery: !!payload.delivery,
      delivery_id: newDeliveryRef ? newDeliveryRef.id : null,
      client_name: payload.delivery?.customer_name || payload.client_name || 'Walk-in Customer',
      created_at: nowIso,
      date: nowIso,
    });

    // 9. Write Delivery Dispatch document if applicable
    if (payload.delivery && newDeliveryRef) {
      tx.set(newDeliveryRef, {
        branch_id: payload.branch_id,
        sale_id: newSaleRef.id,
        invoice_id: invoiceId,
        customer_name: payload.delivery.customer_name,
        customer_phone: payload.delivery.customer_phone,
        delivery_address: payload.delivery.delivery_address,
        courier_name: payload.delivery.courier_name,
        courier_phone: payload.delivery.courier_phone || '',
        order_amount: itemsSubtotal,
        delivery_fee_charged: deliveryFee,
        courier_payout: courierPayout,
        net_delivery_profit: deliveryFee - courierPayout,
        payment_method: payload.payment_method,
        status: 'out_for_delivery',
        dispatched_by_id: payload.seller_id,
        dispatched_by_name: payload.seller_name,
        dispatched_at: nowIso,
      });
    }

    // 10. Increment sequential invoice counter
    tx.set(counterRef, { current_value: nextIdNumber }, { merge: true });

    return {
      saleId: newSaleRef.id,
      invoiceId,
      deliveryId: newDeliveryRef?.id,
      totalRevenue,
    };
  });

  if (payload.delivery && result.deliveryId) {
    triggerServerNotification('/api/v1/retail/delivery-dispatched', {
      branch_id: payload.branch_id,
      invoice_id: result.invoiceId,
      customer_name: payload.delivery.customer_name,
      customer_phone: payload.delivery.customer_phone,
      delivery_address: payload.delivery.delivery_address,
      courier_name: payload.delivery.courier_name,
      delivery_fee_charged: payload.delivery.delivery_fee_charged,
      courier_payout: payload.delivery.courier_payout,
      total_amount: result.totalRevenue,
    });
  }

  return result;
};

export const convertRawToFriedTransaction = async (
  payload: ConvertRawToFriedPayload
): Promise<{ conversionId: string }> => {
  const validOutputs = payload.outputs.filter((o) => o.count_produced > 0);
  if (payload.raw_packet_ids.length === 0) {
    throw new Error('Select at least one raw fish packet to convert.');
  }
  if (validOutputs.length === 0) {
    throw new Error('Enter at least one fried fish piece output count.');
  }

  const conversionsCol = collection(db, 'retail_conversions');
  const historyCol = collection(db, 'retail_inventory_history');

  return await runTransaction(db, async (tx) => {
    const rawRefs = payload.raw_packet_ids.map((id) => doc(db, 'retail_raw_packets', id));
    const rawSnaps = await Promise.all(rawRefs.map((r) => tx.get(r)));

    const friedRefs = validOutputs.map((o) => doc(db, 'retail_fried_stock', o.group_id));
    const friedSnaps = await Promise.all(friedRefs.map((r) => tx.get(r)));

    let totalRawWeightKg = 0;
    let rawEstimatedRevenue = 0;
    let rawCostBasis = 0;
    const packetCodes: string[] = [];

    rawSnaps.forEach((snap, idx) => {
      if (!snap.exists()) {
        throw new Error(`Raw packet ${payload.raw_packet_ids[idx]} does not exist.`);
      }
      const data = snap.data();
      if (data.status !== 'available') {
        throw new Error(`Raw packet ${data.packet_code} is already ${data.status}.`);
      }
      totalRawWeightKg += Number(data.weight_kg) || 0;
      rawEstimatedRevenue += Number(data.total_price) || 0;
      rawCostBasis += Number(data.total_cost) || 0;
      packetCodes.push(data.packet_code || snap.id);
    });

    friedSnaps.forEach((snap, idx) => {
      if (!snap.exists()) {
        throw new Error(`Fried fish price group "${validOutputs[idx].group_name}" does not exist.`);
      }
    });

    const nowIso = new Date().toISOString();
    const conversionRef = doc(conversionsCol);

    const formattedOutputs = validOutputs.map((o) => ({
      group_id: o.group_id,
      group_name: o.group_name,
      unit_price: o.unit_price,
      count_produced: o.count_produced,
      expected_revenue: o.count_produced * o.unit_price,
    }));

    const totalPiecesProduced = formattedOutputs.reduce((s, o) => s + o.count_produced, 0);
    const totalExpectedFriedRevenue = formattedOutputs.reduce((s, o) => s + o.expected_revenue, 0);
    const expectedValueUplift = totalExpectedFriedRevenue - rawEstimatedRevenue;
    const yieldPiecesPerKg =
      totalRawWeightKg > 0 ? Number((totalPiecesProduced / totalRawWeightKg).toFixed(2)) : 0;

    // 1. Mark raw packets as converted_to_fried
    rawSnaps.forEach((snap, idx) => {
      const data = snap.data()!;
      tx.update(rawRefs[idx], {
        status: 'converted_to_fried',
        conversion_id: conversionRef.id,
        converted_at: nowIso,
      });

      const histRef = doc(historyCol);
      tx.set(histRef, {
        branch_id: payload.branch_id,
        item_type: 'raw_packet',
        item_id: rawRefs[idx].id,
        item_label: `${data.packet_code} (${data.weight_kg}kg)`,
        change_qty_or_kg: -(Number(data.weight_kg) || 0),
        reason: `Converted to Fried (${totalPiecesProduced} pcs)`,
        changed_by_name: payload.converted_by_name,
        timestamp: nowIso,
      });
    });

    // 2. Increment Fried Fish stock counts
    friedSnaps.forEach((snap, idx) => {
      const currentQty = Number(snap.data()?.quantity_available) || 0;
      const added = validOutputs[idx].count_produced;
      tx.update(friedRefs[idx], {
        quantity_available: currentQty + added,
        last_updated: nowIso,
        updated_by: payload.converted_by_name,
      });

      const histRef = doc(historyCol);
      tx.set(histRef, {
        branch_id: payload.branch_id,
        item_type: 'fried_fish',
        item_id: friedRefs[idx].id,
        item_label: `${validOutputs[idx].group_name} (KES ${validOutputs[idx].unit_price})`,
        change_qty_or_kg: added,
        reason: `Converted from Raw [${packetCodes.join(', ')}]`,
        changed_by_name: payload.converted_by_name,
        timestamp: nowIso,
      });
    });

    // 3. Record Conversion Document
    tx.set(conversionRef, {
      branch_id: payload.branch_id,
      raw_packet_ids: payload.raw_packet_ids,
      raw_packet_codes: packetCodes,
      total_raw_weight_kg: Number(totalRawWeightKg.toFixed(3)),
      raw_estimated_revenue: Math.round(rawEstimatedRevenue),
      raw_cost_basis: Math.round(rawCostBasis),
      outputs: formattedOutputs,
      total_pieces_produced: totalPiecesProduced,
      total_expected_fried_revenue: totalExpectedFriedRevenue,
      expected_value_uplift: Math.round(expectedValueUplift),
      yield_pieces_per_kg: yieldPiecesPerKg,
      notes: payload.notes || '',
      converted_by_id: payload.converted_by_id,
      converted_by_name: payload.converted_by_name,
      timestamp: nowIso,
    });

    return { conversionId: conversionRef.id };
  });
};

export const closeRetailShiftTransaction = async (
  payload: CloseShiftPayload
): Promise<{ shiftId: string }> => {
  const shiftDocId = `${payload.branch_id}_${payload.date_key}`;
  const shiftRef = doc(db, 'retail_shifts', shiftDocId);

  const cashVariance = payload.declared_cash - payload.system_cash_total;
  const mpesaVariance = payload.declared_mpesa - payload.system_mpesa_total;
  const nowIso = new Date().toISOString();

  await runTransaction(db, async (tx) => {
    tx.set(
      shiftRef,
      {
        branch_id: payload.branch_id,
        date_key: payload.date_key,
        status: 'closed',
        system_cash_total: payload.system_cash_total,
        system_mpesa_total: payload.system_mpesa_total,
        system_total_revenue: payload.system_total_revenue,
        declared_cash: payload.declared_cash,
        declared_mpesa: payload.declared_mpesa,
        cash_variance: cashVariance,
        mpesa_variance: mpesaVariance,
        transaction_count: payload.transaction_count,
        closed_by_id: payload.closed_by_id,
        closed_by_name: payload.closed_by_name,
        notes: payload.notes || '',
        closed_at: nowIso,
      },
      { merge: true }
    );
  });

  triggerServerNotification('/api/v1/retail/shift-closed', {
    branch_id: payload.branch_id,
    date_key: payload.date_key,
    closed_by_name: payload.closed_by_name,
    system_cash_total: payload.system_cash_total,
    system_mpesa_total: payload.system_mpesa_total,
    system_total_revenue: payload.system_total_revenue,
    declared_cash: payload.declared_cash,
    declared_mpesa: payload.declared_mpesa,
    cash_variance: cashVariance,
    mpesa_variance: mpesaVariance,
    transaction_count: payload.transaction_count,
  });

  return { shiftId: shiftDocId };
};

