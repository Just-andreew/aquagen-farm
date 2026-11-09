import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  executeRetailSaleTransaction,
  convertRawToFriedTransaction,
  closeRetailShiftTransaction,
  ExecuteRetailSalePayload,
  ConvertRawToFriedPayload,
  CloseShiftPayload,
  RetailLineItem,
} from '@/lib/firebase/retailTransactions';

export interface Branch {
  id: string;
  name: string;
  location: string;
  raw_price_per_kg: number;
  raw_cost_per_kg: number;
  is_active: boolean;
  created_at: string;
}

export type RawPacketStatus = 'available' | 'sold' | 'converted_to_fried' | 'spoiled';

export interface RawFishPacket {
  id: string;
  branch_id: string;
  packet_code: string;
  weight_kg: number;
  selling_price_per_kg: number;
  cost_per_kg: number;
  total_price: number;
  total_cost: number;
  status: RawPacketStatus;
  notes?: string;
  created_by: string;
  created_at: string;
  sold_sale_id?: string;
  sold_invoice_id?: string;
  conversion_id?: string;
}

export interface FriedFishPriceGroup {
  id: string;
  branch_id: string;
  group_name: string;
  size_label: string;
  unit_price: number;
  unit_cost_estimate: number;
  quantity_available: number;
  last_updated: string;
  updated_by?: string;
}

export interface RetailConversion {
  id: string;
  branch_id: string;
  raw_packet_ids: string[];
  raw_packet_codes: string[];
  total_raw_weight_kg: number;
  raw_estimated_revenue: number;
  raw_cost_basis: number;
  outputs: Array<{
    group_id: string;
    group_name: string;
    unit_price: number;
    count_produced: number;
    expected_revenue: number;
  }>;
  total_pieces_produced: number;
  total_expected_fried_revenue: number;
  expected_value_uplift: number;
  yield_pieces_per_kg: number;
  notes?: string;
  converted_by_id: string;
  converted_by_name: string;
  timestamp: string;
}

export interface RetailSale {
  id: string;
  invoice_id: string;
  type: 'RETAIL_POS';
  branch_id: string;
  shift_date_key: string;
  seller_id: string;
  seller_name: string;
  category: string;
  quantity: number;
  line_items: RetailLineItem[];
  subtotal: number;
  delivery_fee_charged: number;
  courier_payout: number;
  amount: number;
  total: number;
  cogs_total: number;
  gross_margin: number;
  payment_method: 'Cash' | 'M-Pesa';
  status: 'Paid' | 'Void' | 'Reversed';
  is_delivery: boolean;
  delivery_id?: string | null;
  client_name?: string;
  created_at: string;
  date: string;
}

export interface RetailDelivery {
  id: string;
  branch_id: string;
  sale_id: string;
  invoice_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  courier_name: string;
  courier_phone?: string;
  order_amount: number;
  delivery_fee_charged: number;
  courier_payout: number;
  net_delivery_profit: number;
  payment_method: 'Cash' | 'M-Pesa';
  status: 'out_for_delivery' | 'delivered' | 'cancelled';
  dispatched_by_id: string;
  dispatched_by_name: string;
  dispatched_at: string;
  delivered_at?: string;
}

export interface RetailShift {
  id: string;
  branch_id: string;
  date_key: string;
  status: 'open' | 'closed';
  system_cash_total: number;
  system_mpesa_total: number;
  system_total_revenue: number;
  declared_cash: number;
  declared_mpesa: number;
  cash_variance: number;
  mpesa_variance: number;
  transaction_count: number;
  closed_by_id: string;
  closed_by_name: string;
  notes?: string;
  closed_at: string;
}

export interface RetailInventoryHistoryEntry {
  id: string;
  branch_id: string;
  item_type: 'raw_packet' | 'fried_fish';
  item_id: string;
  item_label: string;
  change_qty_or_kg: number;
  reason: string;
  changed_by_name: string;
  timestamp: string;
}

interface RetailContextType {
  branches: Branch[];
  activeBranchId: string;
  activeBranch: Branch | undefined;
  setActiveBranchId: (id: string) => void;
  rawPackets: RawFishPacket[];
  friedStock: FriedFishPriceGroup[];
  retailSales: RetailSale[];
  deliveries: RetailDelivery[];
  shifts: RetailShift[];
  conversions: RetailConversion[];
  retailHistory: RetailInventoryHistoryEntry[];
  loadingRetail: boolean;
  addBranch: (data: { name: string; location: string; raw_price_per_kg: number; raw_cost_per_kg: number }) => Promise<void>;
  updateBranchRates: (branchId: string, rawPricePerKg: number, rawCostPerKg: number) => Promise<void>;
  addRawPacket: (input: { weight_kg: number; selling_price_per_kg?: number; cost_per_kg?: number; notes?: string }) => Promise<void>;
  markRawPacketSpoiled: (packetId: string, reason?: string) => Promise<void>;
  updateFriedStockCount: (groupId: string, deltaOrAbsolute: number, mode: 'delta' | 'set', reason: string) => Promise<void>;
  saveFriedPriceGroup: (group: { id?: string; group_name: string; size_label: string; unit_price: number; unit_cost_estimate: number; quantity_available?: number }) => Promise<void>;
  updateDeliveryStatus: (deliveryId: string, status: 'out_for_delivery' | 'delivered' | 'cancelled') => Promise<void>;
  checkoutRetailSale: (payload: Omit<ExecuteRetailSalePayload, 'branch_id' | 'seller_id' | 'seller_name'>) => Promise<{ saleId: string; invoiceId: string }>;
  convertRawToFried: (payload: Omit<ConvertRawToFriedPayload, 'branch_id' | 'converted_by_id' | 'converted_by_name'>) => Promise<{ conversionId: string }>;
  closeShift: (payload: Omit<CloseShiftPayload, 'branch_id' | 'closed_by_id' | 'closed_by_name'>) => Promise<{ shiftId: string }>;
  syncHistoricalFishSales: () => Promise<{ synced: number; skipped: number }>;
}

const DEFAULT_BRANCH: Branch = {
  id: 'branch_main',
  name: 'Main Branch',
  location: 'Machakos Central',
  raw_price_per_kg: 450,
  raw_cost_per_kg: 300,
  is_active: true,
  created_at: new Date().toISOString(),
};

const DEFAULT_FRIED_TIERS = [
  { id: 'branch_main_tier_small', group_name: 'Small', size_label: 'Small (~200-300g)', unit_price: 150, unit_cost_estimate: 95 },
  { id: 'branch_main_tier_medium', group_name: 'Medium', size_label: 'Medium (~350-450g)', unit_price: 250, unit_cost_estimate: 155 },
  { id: 'branch_main_tier_large', group_name: 'Large', size_label: 'Large (~500-650g)', unit_price: 350, unit_cost_estimate: 215 },
  { id: 'branch_main_tier_jumbo', group_name: 'Jumbo', size_label: 'Jumbo (700g+)', unit_price: 500, unit_cost_estimate: 310 },
];

const RetailContext = createContext<RetailContextType | undefined>(undefined);

export const RetailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [branches, setBranches] = useState<Branch[]>([DEFAULT_BRANCH]);
  const [activeBranchId, setActiveBranchId] = useState<string>('branch_main');

  const [allRawPackets, setAllRawPackets] = useState<RawFishPacket[]>([]);
  const [allFriedStock, setAllFriedStock] = useState<FriedFishPriceGroup[]>([]);
  const [allRetailSales, setAllRetailSales] = useState<RetailSale[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<RetailDelivery[]>([]);
  const [allShifts, setAllShifts] = useState<RetailShift[]>([]);
  const [allConversions, setAllConversions] = useState<RetailConversion[]>([]);
  const [allRetailHistory, setAllRetailHistory] = useState<RetailInventoryHistoryEntry[]>([]);
  const [loadingRetail, setLoadingRetail] = useState<boolean>(true);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Seed default branch & fried price groups if they do not exist yet
    const ensureDefaultsSeeded = async () => {
      try {
        const branchesSnap = await getDocs(collection(db, 'branches'));
        if (branchesSnap.empty) {
          await setDoc(doc(db, 'branches', 'branch_main'), DEFAULT_BRANCH);
        }

        const friedSnap = await getDocs(collection(db, 'retail_fried_stock'));
        if (friedSnap.empty) {
          const nowIso = new Date().toISOString();
          await Promise.all(
            DEFAULT_FRIED_TIERS.map((tier) =>
              setDoc(doc(db, 'retail_fried_stock', tier.id), {
                branch_id: 'branch_main',
                group_name: tier.group_name,
                size_label: tier.size_label,
                unit_price: tier.unit_price,
                unit_cost_estimate: tier.unit_cost_estimate,
                quantity_available: 0,
                last_updated: nowIso,
                updated_by: 'System Seed',
              })
            )
          );
        }
      } catch (err) {
        console.warn('Retail seed check warning:', err);
      }
    };

    ensureDefaultsSeeded();

    const unsubBranches = onSnapshot(
      collection(db, 'branches'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch));
        setBranches(list.length > 0 ? list : [DEFAULT_BRANCH]);
      },
      (err) => console.error('Branches listener error:', err)
    );

    const unsubRaw = onSnapshot(
      collection(db, 'retail_raw_packets'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawFishPacket));
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAllRawPackets(list);
      },
      (err) => console.error('Raw packets listener error:', err)
    );

    const unsubFried = onSnapshot(
      collection(db, 'retail_fried_stock'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriedFishPriceGroup));
        list.sort((a, b) => a.unit_price - b.unit_price);
        setAllFriedStock(list);
      },
      (err) => console.error('Fried stock listener error:', err)
    );

    const unsubSales = onSnapshot(
      collection(db, 'sales'),
      (snap) => {
        const list: RetailSale[] = [];

        snap.docs.forEach((d) => {
          const raw = d.data() as Record<string, any>;

          // Exclude non-fish categories (e.g., Fish Feed) and Quotations
          const catLower = String(raw.category || '').toLowerCase();
          if (catLower.includes('feed') || catLower === 'quotation') return;

          const isExplicitRetail = raw.type === 'RETAIL_POS';

          // Check if legacy POS or B2B sale relates to fish
          const hasFishCategory =
            catLower.includes('fish') ||
            catLower.includes('fingerling') ||
            catLower.includes('tilapia') ||
            catLower.includes('catfish');

          const rawItems: Array<{ item?: string; qty?: number; price?: number }> = Array.isArray(raw.items)
            ? raw.items
            : [];

          const fishB2bItems = rawItems.filter((it) => {
            const label = String(it.item || '').toLowerCase();
            if (label.includes('feed')) return false;
            return (
              label.includes('fish') ||
              label.includes('fingerling') ||
              label.includes('tilapia') ||
              label.includes('catfish') ||
              label.includes('fried') ||
              label.includes('raw') ||
              label.includes('kg') ||
              hasFishCategory
            );
          });

          if (!isExplicitRetail && !hasFishCategory && fishB2bItems.length === 0) {
            return;
          }

          // Normalize legacy fish sales into RetailSale structure so analytics & KPIs populate seamlessly
          const dateStr = raw.created_at || raw.date || new Date().toISOString();
          const totalAmount = Number(raw.total ?? raw.amount) || 0;
          const qty = Number(raw.quantity) || 1;
          const unitPrice = Number(raw.unit_price) || (qty > 0 ? Math.round(totalAmount / qty) : totalAmount);

          let normalizedLineItems: RetailLineItem[] = Array.isArray(raw.line_items) ? raw.line_items : [];

          if (normalizedLineItems.length === 0) {
            if (fishB2bItems.length > 0) {
              normalizedLineItems = fishB2bItems.map((it, idx) => {
                const itemLabel = String(it.item || raw.category || 'Fish Sale');
                const itemLower = itemLabel.toLowerCase();
                const isFried = itemLower.includes('fried') || itemLower.includes('piece') || itemLower.includes('pcs');
                const iQty = Number(it.qty) || 1;
                const iPrice = Number(it.price) || 0;
                const iSub = iQty * iPrice;
                const iCost = Math.round(iSub * 0.65);
                return {
                  item_type: isFried ? 'fried_fish' : 'raw_packet',
                  ref_id: `legacy_${d.id}_${idx}`,
                  label: itemLabel,
                  weight_kg: !isFried ? iQty : undefined,
                  price_group_name: isFried ? itemLabel : undefined,
                  qty: iQty,
                  unit_price: iPrice,
                  unit_cost: Math.round(iPrice * 0.65),
                  subtotal: iSub,
                  cogs: iCost,
                };
              });
            } else {
              const isFried = catLower.includes('fried');
              normalizedLineItems = [
                {
                  item_type: isFried ? 'fried_fish' : 'raw_packet',
                  ref_id: `legacy_${d.id}`,
                  label: raw.category || 'Adult Fish',
                  weight_kg: !isFried ? qty : undefined,
                  price_group_name: isFried ? (raw.category || 'Fried Fish') : undefined,
                  qty,
                  unit_price: unitPrice,
                  unit_cost: Math.round(unitPrice * 0.65),
                  subtotal: totalAmount,
                  cogs: Math.round(totalAmount * 0.65),
                },
              ];
            }
          }

          const computedCogs =
            Number(raw.cogs_total) ||
            normalizedLineItems.reduce((sum, li) => sum + (Number(li.cogs) || 0), 0);

          const rawPay = String(raw.payment_method || raw.payment_terms || 'Cash');
          const normalizedPay: 'Cash' | 'M-Pesa' =
            rawPay.toLowerCase().includes('mpesa') || rawPay.toLowerCase().includes('m-pesa')
              ? 'M-Pesa'
              : 'Cash';

          const rawStatus = String(raw.status || 'Paid').trim();
          if (rawStatus.toLowerCase() === 'draft') return;

          list.push({
            id: d.id,
            invoice_id: raw.invoice_id || 'LEGACY',
            type: 'RETAIL_POS',
            branch_id: raw.branch_id || 'branch_main',
            shift_date_key: raw.shift_date_key || String(dateStr).slice(0, 10),
            seller_id: raw.seller_id || raw.user_id || 'system',
            seller_name: raw.seller_name || 'Historical Sale',
            category: raw.category || 'Fish Sale',
            quantity: qty,
            line_items: normalizedLineItems,
            subtotal: Number(raw.subtotal) || totalAmount,
            delivery_fee_charged: Number(raw.delivery_fee_charged) || 0,
            courier_payout: Number(raw.courier_payout) || 0,
            amount: totalAmount,
            total: totalAmount,
            cogs_total: computedCogs,
            gross_margin: Number(raw.gross_margin) || totalAmount - computedCogs,
            payment_method: normalizedPay,
            status: (rawStatus === 'Void' || rawStatus === 'Reversed' ? rawStatus : 'Paid') as
              | 'Paid'
              | 'Void'
              | 'Reversed',
            is_delivery: !!raw.is_delivery,
            delivery_id: raw.delivery_id || null,
            client_name: raw.client_name || 'Walk-in Customer',
            created_at: dateStr,
            date: dateStr,
          });
        });

        list.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
        setAllRetailSales(list);
        setLoadingRetail(false);
      },
      (err) => {
        console.error('Retail sales listener error:', err);
        setLoadingRetail(false);
      }
    );

    const unsubDeliveries = onSnapshot(
      collection(db, 'retail_deliveries'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailDelivery));
        list.sort((a, b) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime());
        setAllDeliveries(list);
      },
      (err) => console.error('Deliveries listener error:', err)
    );

    const unsubShifts = onSnapshot(
      collection(db, 'retail_shifts'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailShift));
        list.sort((a, b) => b.date_key.localeCompare(a.date_key));
        setAllShifts(list);
      },
      (err) => console.error('Shifts listener error:', err)
    );

    const unsubConversions = onSnapshot(
      collection(db, 'retail_conversions'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailConversion));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAllConversions(list);
      },
      (err) => console.error('Conversions listener error:', err)
    );

    const unsubHistory = onSnapshot(
      collection(db, 'retail_inventory_history'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RetailInventoryHistoryEntry));
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAllRetailHistory(list);
      },
      (err) => console.error('Retail history listener error:', err)
    );

    return () => {
      unsubBranches();
      unsubRaw();
      unsubFried();
      unsubSales();
      unsubDeliveries();
      unsubShifts();
      unsubConversions();
      unsubHistory();
    };
  }, [isAuthenticated]);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0] || DEFAULT_BRANCH;

  // Filter data by active branch
  const rawPackets = allRawPackets.filter((p) => (p.branch_id || 'branch_main') === activeBranchId);
  const friedStock = allFriedStock.filter((f) => (f.branch_id || 'branch_main') === activeBranchId);
  const retailSales = allRetailSales.filter((s) => (s.branch_id || 'branch_main') === activeBranchId);
  const deliveries = allDeliveries.filter((d) => (d.branch_id || 'branch_main') === activeBranchId);
  const shifts = allShifts.filter((s) => (s.branch_id || 'branch_main') === activeBranchId);
  const conversions = allConversions.filter((c) => (c.branch_id || 'branch_main') === activeBranchId);
  const retailHistory = allRetailHistory.filter((h) => (h.branch_id || 'branch_main') === activeBranchId);

  const addBranch = async (data: {
    name: string;
    location: string;
    raw_price_per_kg: number;
    raw_cost_per_kg: number;
  }) => {
    const slug = `branch_${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
    const nowIso = new Date().toISOString();
    await setDoc(doc(db, 'branches', slug), {
      id: slug,
      name: data.name,
      location: data.location,
      raw_price_per_kg: data.raw_price_per_kg,
      raw_cost_per_kg: data.raw_cost_per_kg,
      is_active: true,
      created_at: nowIso,
    });

    // Seed the 4 default fried fish price tiers for the new branch
    await Promise.all(
      DEFAULT_FRIED_TIERS.map((tier) => {
        const tierId = `${slug}_${tier.group_name.toLowerCase()}`;
        return setDoc(doc(db, 'retail_fried_stock', tierId), {
          branch_id: slug,
          group_name: tier.group_name,
          size_label: tier.size_label,
          unit_price: tier.unit_price,
          unit_cost_estimate: tier.unit_cost_estimate,
          quantity_available: 0,
          last_updated: nowIso,
          updated_by: user?.name || 'Admin',
        });
      })
    );
    setActiveBranchId(slug);
  };

  const updateBranchRates = async (branchId: string, rawPricePerKg: number, rawCostPerKg: number) => {
    await updateDoc(doc(db, 'branches', branchId), {
      raw_price_per_kg: rawPricePerKg,
      raw_cost_per_kg: rawCostPerKg,
    });
  };

  const addRawPacket = async (input: {
    weight_kg: number;
    selling_price_per_kg?: number;
    cost_per_kg?: number;
    notes?: string;
  }) => {
    const weight = Number(input.weight_kg.toFixed(3));
    const sellPerKg = input.selling_price_per_kg ?? activeBranch.raw_price_per_kg ?? 450;
    const costPerKg = input.cost_per_kg ?? activeBranch.raw_cost_per_kg ?? 300;
    const totalPrice = Math.round(weight * sellPerKg);
    const totalCost = Math.round(weight * costPerKg);
    const nowIso = new Date().toISOString();

    const seqNum = rawPackets.length + 1;
    const packetCode = `PKT-${String(seqNum).padStart(3, '0')}`;

    const docRef = await addDoc(collection(db, 'retail_raw_packets'), {
      branch_id: activeBranchId,
      packet_code: packetCode,
      weight_kg: weight,
      selling_price_per_kg: sellPerKg,
      cost_per_kg: costPerKg,
      total_price: totalPrice,
      total_cost: totalCost,
      status: 'available',
      notes: input.notes || '',
      created_by: user?.name || 'Staff',
      created_at: nowIso,
    });

    await addDoc(collection(db, 'retail_inventory_history'), {
      branch_id: activeBranchId,
      item_type: 'raw_packet',
      item_id: docRef.id,
      item_label: `${packetCode} (${weight} kg)`,
      change_qty_or_kg: weight,
      reason: 'New Raw Packet Weighed',
      changed_by_name: user?.name || 'Staff',
      timestamp: nowIso,
    });
  };

  const markRawPacketSpoiled = async (packetId: string, reason: string = 'Spoilage / Removed') => {
    const packet = rawPackets.find((p) => p.id === packetId);
    if (!packet) return;
    const nowIso = new Date().toISOString();

    await updateDoc(doc(db, 'retail_raw_packets', packetId), {
      status: 'spoiled',
      notes: reason,
    });

    await addDoc(collection(db, 'retail_inventory_history'), {
      branch_id: activeBranchId,
      item_type: 'raw_packet',
      item_id: packetId,
      item_label: `${packet.packet_code} (${packet.weight_kg} kg)`,
      change_qty_or_kg: -packet.weight_kg,
      reason,
      changed_by_name: user?.name || 'Staff',
      timestamp: nowIso,
    });
  };

  const updateFriedStockCount = async (
    groupId: string,
    deltaOrAbsolute: number,
    mode: 'delta' | 'set',
    reason: string = 'Seller Stock Update'
  ) => {
    const group = friedStock.find((g) => g.id === groupId);
    if (!group) return;

    const currentQty = Number(group.quantity_available) || 0;
    const newQty = mode === 'delta' ? Math.max(0, currentQty + deltaOrAbsolute) : Math.max(0, deltaOrAbsolute);
    const diff = newQty - currentQty;
    if (diff === 0) return;

    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'retail_fried_stock', groupId), {
      quantity_available: newQty,
      last_updated: nowIso,
      updated_by: user?.name || 'Staff',
    });

    await addDoc(collection(db, 'retail_inventory_history'), {
      branch_id: activeBranchId,
      item_type: 'fried_fish',
      item_id: groupId,
      item_label: `${group.group_name} (KES ${group.unit_price})`,
      change_qty_or_kg: diff,
      reason,
      changed_by_name: user?.name || 'Staff',
      timestamp: nowIso,
    });
  };

  const saveFriedPriceGroup = async (group: {
    id?: string;
    group_name: string;
    size_label: string;
    unit_price: number;
    unit_cost_estimate: number;
    quantity_available?: number;
  }) => {
    const nowIso = new Date().toISOString();
    if (group.id) {
      await updateDoc(doc(db, 'retail_fried_stock', group.id), {
        group_name: group.group_name,
        size_label: group.size_label,
        unit_price: group.unit_price,
        unit_cost_estimate: group.unit_cost_estimate,
        last_updated: nowIso,
        updated_by: user?.name || 'Admin',
      });
    } else {
      const slugId = `${activeBranchId}_tier_${group.group_name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-3)}`;
      await setDoc(doc(db, 'retail_fried_stock', slugId), {
        branch_id: activeBranchId,
        group_name: group.group_name,
        size_label: group.size_label,
        unit_price: group.unit_price,
        unit_cost_estimate: group.unit_cost_estimate,
        quantity_available: group.quantity_available ?? 0,
        last_updated: nowIso,
        updated_by: user?.name || 'Admin',
      });
    }
  };

  const updateDeliveryStatus = async (
    deliveryId: string,
    status: 'out_for_delivery' | 'delivered' | 'cancelled'
  ) => {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'retail_deliveries', deliveryId), {
      status,
      ...(status === 'delivered' ? { delivered_at: nowIso } : {}),
    });
  };

  const checkoutRetailSale = async (
    payload: Omit<ExecuteRetailSalePayload, 'branch_id' | 'seller_id' | 'seller_name'>
  ) => {
    return await executeRetailSaleTransaction({
      ...payload,
      branch_id: activeBranchId,
      seller_id: user?.id || 'unknown',
      seller_name: user?.name || 'Seller',
    });
  };

  const convertRawToFried = async (
    payload: Omit<ConvertRawToFriedPayload, 'branch_id' | 'converted_by_id' | 'converted_by_name'>
  ) => {
    return await convertRawToFriedTransaction({
      ...payload,
      branch_id: activeBranchId,
      converted_by_id: user?.id || 'admin',
      converted_by_name: user?.name || 'Admin',
    });
  };

  const closeShift = async (
    payload: Omit<CloseShiftPayload, 'branch_id' | 'closed_by_id' | 'closed_by_name'>
  ) => {
    return await closeRetailShiftTransaction({
      ...payload,
      branch_id: activeBranchId,
      closed_by_id: user?.id || 'seller',
      closed_by_name: user?.name || 'Seller',
    });
  };

  const syncHistoricalFishSales = async (): Promise<{ synced: number; skipped: number }> => {
    const salesSnap = await getDocs(collection(db, 'sales'));
    let synced = 0;
    let skipped = 0;

    for (const docSnap of salesSnap.docs) {
      const data = docSnap.data();
      const cat = String(data.category || '');
      const catLower = cat.toLowerCase();

      // Strictly exclude Fish Feed, Quotations, and Drafts
      if (catLower.includes('feed') || catLower === 'quotation' || String(data.status).toLowerCase() === 'draft') {
        skipped++;
        continue;
      }

      const rawItems: Array<{ item?: string; qty?: number; price?: number }> = Array.isArray(data.items)
        ? data.items
        : [];
      const fishItems = rawItems.filter((it) => {
        const label = String(it.item || '').toLowerCase();
        if (label.includes('feed')) return false;
        return (
          label.includes('fish') ||
          label.includes('fingerling') ||
          label.includes('tilapia') ||
          label.includes('catfish') ||
          label.includes('fried') ||
          label.includes('raw') ||
          label.includes('kg')
        );
      });

      const isFishCategory =
        catLower.includes('fish') ||
        catLower.includes('fingerling') ||
        catLower.includes('tilapia') ||
        catLower.includes('catfish');

      if (!isFishCategory && fishItems.length === 0 && data.type !== 'RETAIL_POS') {
        skipped++;
        continue;
      }

      if (data.branch_id && Array.isArray(data.line_items) && data.line_items.length > 0) {
        continue;
      }

      const totalAmount = Number(data.total ?? data.amount) || 0;
      const qty = Number(data.quantity) || 1;
      const unitPrice = Number(data.unit_price) || (qty > 0 ? Math.round(totalAmount / qty) : totalAmount);
      const dateStr = data.created_at || data.date || new Date().toISOString();

      const lineItems: RetailLineItem[] =
        fishItems.length > 0
          ? fishItems.map((it, idx) => {
            const label = String(it.item || cat || 'Fish Sale');
            const isFried = label.toLowerCase().includes('fried');
            const iQty = Number(it.qty) || 1;
            const iPrice = Number(it.price) || 0;
            const sub = iQty * iPrice;
            const cogs = Math.round(sub * 0.65);
            return {
              item_type: isFried ? 'fried_fish' : 'raw_packet',
              ref_id: `legacy_${docSnap.id}_${idx}`,
              label,
              ...(isFried ? { price_group_name: label } : { weight_kg: iQty }),
              qty: iQty,
              unit_price: iPrice,
              unit_cost: Math.round(iPrice * 0.65),
              subtotal: sub,
              cogs,
            };
          })
          : [
            {
              item_type: catLower.includes('fried') ? 'fried_fish' : 'raw_packet',
              ref_id: `legacy_${docSnap.id}`,
              label: cat || 'Adult Fish',
              ...(catLower.includes('fried') ? { price_group_name: cat || 'Fried Fish' } : { weight_kg: qty }),
              qty,
              unit_price: unitPrice,
              unit_cost: Math.round(unitPrice * 0.65),
              subtotal: totalAmount,
              cogs: Math.round(totalAmount * 0.65),
            },
          ];

      const cogsTotal = lineItems.reduce((s, li) => s + li.cogs, 0);
      const grossMargin = totalAmount - cogsTotal;

      await updateDoc(doc(db, 'sales', docSnap.id), {
        branch_id: data.branch_id || activeBranchId,
        shift_date_key: data.shift_date_key || String(dateStr).slice(0, 10),
        line_items: lineItems,
        cogs_total: data.cogs_total ?? cogsTotal,
        gross_margin: data.gross_margin ?? grossMargin,
      });

      synced++;
    }

    return { synced, skipped };
  };

  return (
    <RetailContext.Provider
      value={{
        branches,
        activeBranchId,
        activeBranch,
        setActiveBranchId,
        rawPackets,
        friedStock,
        retailSales,
        deliveries,
        shifts,
        conversions,
        retailHistory,
        loadingRetail,
        addBranch,
        updateBranchRates,
        addRawPacket,
        markRawPacketSpoiled,
        updateFriedStockCount,
        saveFriedPriceGroup,
        updateDeliveryStatus,
        checkoutRetailSale,
        convertRawToFried,
        closeShift,
        syncHistoricalFishSales,
      }}
    >
      {children}
    </RetailContext.Provider>
  );
};

export const useRetail = () => {
  const context = useContext(RetailContext);
  if (!context) throw new Error('useRetail must be used within a RetailProvider');
  return context;
};

