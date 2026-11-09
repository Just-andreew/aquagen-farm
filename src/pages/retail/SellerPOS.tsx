import { useState, useMemo } from 'react';
import { useRetail, RawFishPacket, FriedFishPriceGroup } from '@/contexts/RetailContext';
import { RetailLineItem } from '@/lib/firebase/retailTransactions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  ShoppingCart,
  Scale,
  Flame,
  Truck,
  Lock,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Banknote,
  Smartphone,
  Clock,
  Store,
  TrendingUp,
  PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';

interface SellerPOSProps {
  embeddedInAdmin?: boolean;
}

const getDateKey = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SellerPOS = ({ embeddedInAdmin = false }: SellerPOSProps) => {
  const {
    activeBranch,
    rawPackets,
    friedStock,
    retailSales,
    deliveries,
    shifts,
    addRawPacket,
    markRawPacketSpoiled,
    updateFriedStockCount,
    updateDeliveryStatus,
    checkoutRetailSale,
    closeShift,
  } = useRetail();

  // --- CART STATE ---
  const [selectedRawIds, setSelectedRawIds] = useState<string[]>([]);
  const [friedCart, setFriedCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'M-Pesa'>('Cash');
  const [isDelivery, setIsDelivery] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [courierName, setCourierName] = useState('');
  const [courierPhone, setCourierPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(100);
  const [courierPayout, setCourierPayout] = useState<number>(80);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // --- ADD RAW PACKET STATE ---
  const [newWeightKg, setNewWeightKg] = useState<string>('');
  const [customPricePerKg, setCustomPricePerKg] = useState<string>('');
  const [rawNotes, setRawNotes] = useState('');

  // --- FRIED FISH STOCK ADJUSTMENT STATE ---
  const [stockReason, setStockReason] = useState<string>('Fresh Batch Fried');
  const [directCountInputs, setDirectCountInputs] = useState<Record<string, string>>({});

  // --- EOD SHIFT MODAL STATE ---
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [declaredCash, setDeclaredCash] = useState<string>('');
  const [declaredMpesa, setDeclaredMpesa] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  // --- REAL-TIME SALES METRICS (TODAY, YESTERDAY, THIS WEEK, LAST WEEK) ---
  const todayKey = getDateKey(new Date());
  const todayShift = shifts.find((s) => s.date_key === todayKey);

  const salesMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);

    // Monday as start of week
    const dayOfWeek = todayStart.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(todayStart.getDate() + diffToMonday);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    let todayTotal = 0;
    let todayCount = 0;
    let todayCash = 0;
    let todayMpesa = 0;
    let yesterdayTotal = 0;
    let yesterdayCount = 0;
    let thisWeekTotal = 0;
    let thisWeekCount = 0;
    let lastWeekTotal = 0;
    let lastWeekCount = 0;

    const validSales = retailSales.filter((s) => s.status === 'Paid');

    validSales.forEach((sale) => {
      const d = new Date(sale.created_at || sale.date);
      if (isNaN(d.getTime())) return;
      const amt = Number(sale.total || sale.amount) || 0;

      if (d >= todayStart) {
        todayTotal += amt;
        todayCount += 1;
        if (sale.payment_method === 'M-Pesa') todayMpesa += amt;
        else todayCash += amt;
      } else if (d >= yesterdayStart && d < todayStart) {
        yesterdayTotal += amt;
        yesterdayCount += 1;
      }

      if (d >= thisWeekStart) {
        thisWeekTotal += amt;
        thisWeekCount += 1;
      } else if (d >= lastWeekStart && d < thisWeekStart) {
        lastWeekTotal += amt;
        lastWeekCount += 1;
      }
    });

    return {
      todayTotal,
      todayCount,
      todayCash,
      todayMpesa,
      yesterdayTotal,
      yesterdayCount,
      thisWeekTotal,
      thisWeekCount,
      lastWeekTotal,
      lastWeekCount,
    };
  }, [retailSales]);

  // --- AVAILABLE STOCK ---
  const availableRawPackets = useMemo(
    () => rawPackets.filter((p) => p.status === 'available'),
    [rawPackets]
  );

  // --- COMPUTED CART LINE ITEMS ---
  const cartLineItems: RetailLineItem[] = useMemo(() => {
    const items: RetailLineItem[] = [];

    // 1. Fried fish items
    Object.entries(friedCart).forEach(([groupId, qty]) => {
      if (qty <= 0) return;
      const group = friedStock.find((g) => g.id === groupId);
      if (!group) return;
      items.push({
        item_type: 'fried_fish',
        ref_id: group.id,
        label: `Fried Fish - ${group.group_name} (KES ${group.unit_price})`,
        price_group_name: group.group_name,
        qty,
        unit_price: group.unit_price,
        unit_cost: group.unit_cost_estimate || Math.round(group.unit_price * 0.62),
        subtotal: qty * group.unit_price,
        cogs: qty * (group.unit_cost_estimate || Math.round(group.unit_price * 0.62)),
      });
    });

    // 2. Raw fish packets
    selectedRawIds.forEach((pktId) => {
      const pkt = availableRawPackets.find((p) => p.id === pktId);
      if (!pkt) return;
      items.push({
        item_type: 'raw_packet',
        ref_id: pkt.id,
        label: `Raw Packet ${pkt.packet_code} (${pkt.weight_kg} kg)`,
        weight_kg: pkt.weight_kg,
        qty: 1,
        unit_price: pkt.total_price,
        unit_cost: pkt.total_cost,
        subtotal: pkt.total_price,
        cogs: pkt.total_cost,
      });
    });

    return items;
  }, [friedCart, selectedRawIds, friedStock, availableRawPackets]);

  const cartItemsSubtotal = cartLineItems.reduce((sum, i) => sum + i.subtotal, 0);
  const effectiveDeliveryFee = isDelivery ? Number(deliveryFee) || 0 : 0;
  const cartGrandTotal = cartItemsSubtotal + effectiveDeliveryFee;

  // --- CART HANDLERS ---
  const handleAddFriedToCart = (group: FriedFishPriceGroup, delta: number) => {
    setFriedCart((prev) => {
      const current = prev[group.id] || 0;
      const next = Math.max(0, current + delta);
      if (next > group.quantity_available) {
        toast.error(`Only ${group.quantity_available} ${group.group_name} fried fish available in stock!`);
        return prev;
      }
      const updated = { ...prev };
      if (next === 0) delete updated[group.id];
      else updated[group.id] = next;
      return updated;
    });
  };

  const handleToggleRawPacket = (packet: RawFishPacket) => {
    setSelectedRawIds((prev) =>
      prev.includes(packet.id) ? prev.filter((id) => id !== packet.id) : [...prev, packet.id]
    );
  };

  const handleClearCart = () => {
    setSelectedRawIds([]);
    setFriedCart({});
    setIsDelivery(false);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setCourierName('');
    setCourierPhone('');
  };

  const handleCheckout = async () => {
    if (cartLineItems.length === 0) {
      return toast.error('Cart is empty. Add Fried Fish or Raw Fish packets first.');
    }
    if (isDelivery) {
      if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !courierName.trim()) {
        return toast.error('Please fill Customer Name, Phone, Address, and Courier Name for delivery.');
      }
    }

    setIsCheckingOut(true);
    try {
      const res = await checkoutRetailSale({
        shift_date_key: todayKey,
        payment_method: paymentMethod,
        line_items: cartLineItems,
        client_name: customerName.trim() || 'Walk-in Customer',
        ...(isDelivery
          ? {
              delivery: {
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                delivery_address: deliveryAddress.trim(),
                courier_name: courierName.trim(),
                courier_phone: courierPhone.trim(),
                delivery_fee_charged: Number(deliveryFee) || 0,
                courier_payout: Number(courierPayout) || 0,
              },
            }
          : {}),
      });

      toast.success(
        isDelivery
          ? `Sale ${res.invoiceId} logged & dispatched Out for Delivery!`
          : `Sale ${res.invoiceId} completed (${paymentMethod} - KES ${cartGrandTotal.toLocaleString()})`
      );
      handleClearCart();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete POS checkout');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // --- INVENTORY HANDLERS ---
  const handleCreateRawPacket = async () => {
    const w = parseFloat(newWeightKg);
    if (isNaN(w) || w <= 0) {
      return toast.error('Enter a valid weight in kilograms (e.g., 1.25).');
    }
    const priceOverride = customPricePerKg ? parseFloat(customPricePerKg) : undefined;
    try {
      await addRawPacket({
        weight_kg: w,
        selling_price_per_kg: priceOverride && priceOverride > 0 ? priceOverride : undefined,
        notes: rawNotes.trim(),
      });
      toast.success(`Added ${w} kg Raw Fish Packet to live inventory!`);
      setNewWeightKg('');
      setCustomPricePerKg('');
      setRawNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add raw packet');
    }
  };

  const handleSetFriedCount = async (group: FriedFishPriceGroup) => {
    const rawVal = directCountInputs[group.id];
    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed) || parsed < 0) {
      return toast.error('Enter a valid non-negative count.');
    }
    try {
      await updateFriedStockCount(group.id, parsed, 'set', stockReason);
      toast.success(`Updated ${group.group_name} stock to ${parsed} pcs`);
      setDirectCountInputs((prev) => ({ ...prev, [group.id]: '' }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update fried stock');
    }
  };

  // --- SHIFT CLOSE HANDLER ---
  const openCloseShiftDialog = () => {
    setDeclaredCash(String(salesMetrics.todayCash));
    setDeclaredMpesa(String(salesMetrics.todayMpesa));
    setIsCloseShiftOpen(true);
  };

  const handleConfirmCloseShift = async () => {
    const cashVal = parseFloat(declaredCash) || 0;
    const mpesaVal = parseFloat(declaredMpesa) || 0;
    setIsClosingShift(true);
    try {
      await closeShift({
        date_key: todayKey,
        system_cash_total: salesMetrics.todayCash,
        system_mpesa_total: salesMetrics.todayMpesa,
        system_total_revenue: salesMetrics.todayTotal,
        declared_cash: cashVal,
        declared_mpesa: mpesaVal,
        transaction_count: salesMetrics.todayCount,
        notes: shiftNotes.trim(),
      });
      toast.success('End of Day Shift Closed & Reconciled!');
      setIsCloseShiftOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to close shift');
    } finally {
      setIsClosingShift(false);
    }
  };

  const activeDeliveries = deliveries.filter((d) => d.status === 'out_for_delivery');

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      {!embeddedInAdmin && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-7 w-7 text-[#14B8A6]" />
              <h1 className="text-3xl font-bold text-[#14B8A6]">Retail POS Terminal</h1>
              <Badge className="bg-[#014D4D] text-[#5EEAD4] border-[#14B8A6]/40">
                {activeBranch?.name || 'Main Branch'}
              </Badge>
            </div>
            <p className="text-[#94A3B8]">
              Fast checkout, live raw packet & fried fish inventory, delivery dispatch, and shift closure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {todayShift?.status === 'closed' ? (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 px-3 py-1.5 text-xs">
                Shift Closed Today ({new Date(todayShift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 px-3 py-1.5 text-xs">
                Shift Open • {todayKey}
              </Badge>
            )}
            <Button
              onClick={openCloseShiftDialog}
              className="bg-amber-500 hover:bg-amber-600 text-[#013333] font-bold gap-2"
            >
              <Lock className="h-4 w-4" />
              {todayShift?.status === 'closed' ? 'Re-Tally / Update EOD' : 'Close Shift (EOD)'}
            </Button>
          </div>
        </div>
      )}

      {/* REAL-TIME SALES TRACKING RIBBON (Today, Yesterday, This Week, Last Week) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#013333] border-[#14B8A6]/30">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5EEAD4]">Today's Sales</span>
              <Badge variant="outline" className="text-[10px] border-[#14B8A6]/40 text-[#5EEAD4]">
                {salesMetrics.todayCount} orders
              </Badge>
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              KES {salesMetrics.todayTotal.toLocaleString()}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-[#94A3B8]">
              <span className="text-amber-300">Cash: {salesMetrics.todayCash.toLocaleString()}</span>
              <span>•</span>
              <span className="text-emerald-300">M-Pesa: {salesMetrics.todayMpesa.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Yesterday</span>
              <span className="text-[11px] text-slate-400">{salesMetrics.yesterdayCount} orders</span>
            </div>
            <div className="text-2xl font-bold text-slate-200 mt-1">
              KES {salesMetrics.yesterdayTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Previous day total</p>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5EEAD4]">This Week</span>
              <TrendingUp className="h-3.5 w-3.5 text-[#14B8A6]" />
            </div>
            <div className="text-2xl font-bold text-white mt-1">
              KES {salesMetrics.thisWeekTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-2">{salesMetrics.thisWeekCount} orders since Monday</p>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">Last Week</span>
              <Clock className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-200 mt-1">
              KES {salesMetrics.lastWeekTotal.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{salesMetrics.lastWeekCount} orders last week</p>
          </CardContent>
        </Card>
      </div>

      {/* MAIN POS WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 cols): QUICK POS PRODUCT SELECTION & CHECKOUT */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-[#013333] border-[#14B8A6]/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-[#5EEAD4] flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" /> Quick POS Selector
                  </CardTitle>
                  <CardDescription className="text-[#94A3B8]">
                    Tap Fried Fish price groups or available Raw Fish packets to build the order.
                  </CardDescription>
                </div>
                {embeddedInAdmin && (
                  <Button
                    size="sm"
                    onClick={openCloseShiftDialog}
                    className="bg-amber-500 hover:bg-amber-600 text-[#013333] font-bold gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" /> Close Shift (EOD)
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 1. FRIED FISH PRICE GROUPS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-[#5EEAD4] flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-400" /> Fried Fish (By Price Tier)
                  </Label>
                  <span className="text-xs text-[#94A3B8]">
                    Total Available: {friedStock.reduce((s, g) => s + (Number(g.quantity_available) || 0), 0)} pcs
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {friedStock.map((group) => {
                    const inCart = friedCart[group.id] || 0;
                    const outOfStock = group.quantity_available <= 0;
                    return (
                      <div
                        key={group.id}
                        className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                          inCart > 0
                            ? 'bg-[#14B8A6]/20 border-[#14B8A6] shadow-md'
                            : outOfStock
                            ? 'bg-[#014D4D]/30 border-slate-700/50 opacity-60'
                            : 'bg-[#014D4D] border-[#14B8A6]/30 hover:border-[#14B8A6]'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-white text-sm">{group.group_name}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                outOfStock
                                  ? 'border-red-500/40 text-red-400'
                                  : 'border-[#14B8A6]/40 text-[#5EEAD4]'
                              }`}
                            >
                              {group.quantity_available} left
                            </Badge>
                          </div>
                          <div className="text-lg font-extrabold text-[#5EEAD4] mt-1">
                            KES {group.unit_price}
                          </div>
                          <div className="text-[10px] text-[#94A3B8] truncate">{group.size_label}</div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#14B8A6]/20">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={inCart <= 0}
                            onClick={() => handleAddFriedToCart(group, -1)}
                            className="h-7 w-7 border-[#14B8A6]/40 bg-[#013333] text-white"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="font-bold text-white text-sm">{inCart}</span>
                          <Button
                            type="button"
                            size="icon"
                            disabled={outOfStock || inCart >= group.quantity_available}
                            onClick={() => handleAddFriedToCart(group, 1)}
                            className="h-7 w-7 bg-[#14B8A6] text-[#013333] hover:bg-[#5EEAD4]"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. RAW FISH PACKETS (WEIGHT-BASED) */}
              <div className="space-y-3 pt-2 border-t border-[#14B8A6]/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-[#5EEAD4] flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-cyan-400" /> Available Raw Fish Packets ({availableRawPackets.length})
                  </Label>
                  <span className="text-xs text-[#94A3B8]">
                    Rate: KES {activeBranch?.raw_price_per_kg || 450}/kg
                  </span>
                </div>

                {availableRawPackets.length === 0 ? (
                  <div className="text-center py-6 bg-[#014D4D]/40 rounded-lg border border-dashed border-[#14B8A6]/20 text-xs text-[#94A3B8]">
                    No weighed raw packets available. Weigh and add a packet on the right panel.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {availableRawPackets.map((pkt) => {
                      const isSelected = selectedRawIds.includes(pkt.id);
                      return (
                        <button
                          key={pkt.id}
                          type="button"
                          onClick={() => handleToggleRawPacket(pkt)}
                          className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#14B8A6] text-[#013333] border-white font-semibold'
                              : 'bg-[#014D4D] text-white border-[#14B8A6]/30 hover:border-[#14B8A6]'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="text-xs font-mono font-bold">{pkt.packet_code}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                isSelected ? 'bg-[#013333] text-[#5EEAD4]' : 'bg-[#013333]/70 text-[#5EEAD4]'
                              }`}
                            >
                              {pkt.weight_kg} kg
                            </span>
                          </div>
                          <div className="mt-2 text-base font-extrabold">
                            KES {pkt.total_price.toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. ACTIVE ORDER SUMMARY & CHECKOUT */}
              <div className="pt-4 border-t border-[#14B8A6]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Current Order ({cartLineItems.length} lines)</span>
                  {cartLineItems.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCart}
                      className="text-xs text-rose-400 hover:text-rose-300 h-7 px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {cartLineItems.length > 0 && (
                  <div className="bg-[#014D4D]/60 rounded-lg p-3 space-y-2 border border-[#14B8A6]/20">
                    {cartLineItems.map((line) => (
                      <div key={`${line.item_type}_${line.ref_id}`} className="flex justify-between text-xs text-slate-200">
                        <span>
                          {line.qty}x {line.label}
                        </span>
                        <span className="font-bold text-[#5EEAD4]">KES {line.subtotal.toLocaleString()}</span>
                      </div>
                    ))}
                    {isDelivery && (
                      <div className="flex justify-between text-xs text-amber-300 pt-1 border-t border-[#14B8A6]/10">
                        <span>+ Delivery Charge</span>
                        <span className="font-bold">KES {(Number(deliveryFee) || 0).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* PAYMENT METHOD & DELIVERY DISPATCH TOGGLE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8]">Payment Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`h-10 font-bold gap-2 ${
                          paymentMethod === 'Cash'
                            ? 'bg-amber-400 text-[#013333] hover:bg-amber-400'
                            : 'bg-[#014D4D] text-slate-300 border border-[#14B8A6]/20'
                        }`}
                      >
                        <Banknote className="h-4 w-4" /> Cash
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setPaymentMethod('M-Pesa')}
                        className={`h-10 font-bold gap-2 ${
                          paymentMethod === 'M-Pesa'
                            ? 'bg-emerald-400 text-[#013333] hover:bg-emerald-400'
                            : 'bg-[#014D4D] text-slate-300 border border-[#14B8A6]/20'
                        }`}
                      >
                        <Smartphone className="h-4 w-4" /> M-Pesa
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8]">Fulfillment</Label>
                    <Button
                      type="button"
                      onClick={() => setIsDelivery(!isDelivery)}
                      className={`w-full h-10 font-bold gap-2 ${
                        isDelivery
                          ? 'bg-cyan-400 text-[#013333] hover:bg-cyan-300'
                          : 'bg-[#014D4D] text-slate-300 border border-[#14B8A6]/20'
                      }`}
                    >
                      <Truck className="h-4 w-4" />
                      {isDelivery ? 'Out for Delivery (Active)' : 'Mark as Out for Delivery'}
                    </Button>
                  </div>
                </div>

                {/* DELIVERY DISPATCH FORM */}
                {isDelivery && (
                  <div className="p-4 rounded-lg bg-[#014D4D]/70 border border-cyan-400/40 space-y-3">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Truck className="h-4 w-4" /> Delivery Dispatch & Courier Assignment
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-300">Customer Name *</Label>
                        <Input
                          placeholder="e.g. Mary Wambui"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Customer Phone *</Label>
                        <Input
                          placeholder="e.g. 0712 345 678"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs text-slate-300">Delivery Location / Address *</Label>
                        <Input
                          placeholder="e.g. Syokimau, Katani Road Gate B"
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Assigned Courier / Rider *</Label>
                        <Input
                          placeholder="e.g. Peter (Bodaboda)"
                          value={courierName}
                          onChange={(e) => setCourierName(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-300">Courier Phone</Label>
                        <Input
                          placeholder="e.g. 0722 000 111"
                          value={courierPhone}
                          onChange={(e) => setCourierPhone(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-emerald-300">Delivery Fee Charged (KES)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Number(e.target.value))}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-rose-300">Courier Payout (KES)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={courierPayout}
                          onChange={(e) => setCourierPayout(Number(e.target.value))}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* COMPLETE SALE BUTTON */}
                <Button
                  type="button"
                  disabled={isCheckingOut || cartLineItems.length === 0}
                  onClick={handleCheckout}
                  className="w-full h-12 bg-[#14B8A6] hover:bg-[#5EEAD4] text-[#013333] font-extrabold text-base shadow-lg"
                >
                  {isCheckingOut
                    ? 'Processing Sale...'
                    : `Complete Sale • KES ${cartGrandTotal.toLocaleString()} (${paymentMethod})`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN (5 cols): LIVE INVENTORY & DELIVERY MANAGEMENT */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-[#013333] border-[#14B8A6]/30">
            <CardContent className="p-4">
              <Tabs defaultValue="fried_stock">
                <TabsList className="w-full grid grid-cols-3 bg-[#014D4D] border border-[#14B8A6]/30">
                  <TabsTrigger
                    value="fried_stock"
                    className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] text-xs font-bold"
                  >
                    Fried Stock
                  </TabsTrigger>
                  <TabsTrigger
                    value="raw_packets"
                    className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] text-xs font-bold"
                  >
                    Raw Packets ({availableRawPackets.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="deliveries"
                    className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] text-xs font-bold"
                  >
                    Deliveries ({activeDeliveries.length})
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: LIVE FRIED FISH INVENTORY */}
                <TabsContent value="fried_stock" className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#94A3B8]">Stock Update Reason</Label>
                    <Select value={stockReason} onValueChange={setStockReason}>
                      <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                        <SelectItem value="Fresh Batch Fried">Fresh Batch Fried</SelectItem>
                        <SelectItem value="Opening Stock Count">Opening Stock Count</SelectItem>
                        <SelectItem value="Manual Stock Adjustment">Manual Stock Adjustment</SelectItem>
                        <SelectItem value="Spoilage / Damaged">Spoilage / Damaged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {friedStock.map((group) => (
                      <div
                        key={group.id}
                        className="p-3 rounded-lg bg-[#014D4D]/70 border border-[#14B8A6]/20 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white text-sm">
                              {group.group_name} — <span className="text-[#5EEAD4]">KES {group.unit_price}</span>
                            </div>
                            <div className="text-[11px] text-[#94A3B8]">{group.size_label}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-extrabold text-white">{group.quantity_available}</div>
                            <div className="text-[10px] text-[#5EEAD4]">pieces in stock</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#14B8A6]/10">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFriedStockCount(group.id, -1, 'delta', stockReason)}
                              disabled={group.quantity_available <= 0}
                              className="h-7 px-2 border-rose-500/40 text-rose-300 bg-[#013333]"
                            >
                              -1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFriedStockCount(group.id, 1, 'delta', stockReason)}
                              className="h-7 px-2 border-[#14B8A6]/40 text-[#5EEAD4] bg-[#013333]"
                            >
                              +1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateFriedStockCount(group.id, 5, 'delta', stockReason)}
                              className="h-7 px-2 border-[#14B8A6]/40 text-[#5EEAD4] bg-[#013333]"
                            >
                              +5
                            </Button>
                          </div>

                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              placeholder="Set qty"
                              value={directCountInputs[group.id] || ''}
                              onChange={(e) =>
                                setDirectCountInputs((prev) => ({ ...prev, [group.id]: e.target.value }))
                              }
                              className="w-20 h-7 text-xs bg-[#013333] border-[#14B8A6]/30 text-white"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSetFriedCount(group)}
                              className="h-7 px-2.5 bg-[#14B8A6] text-[#013333] font-bold text-xs"
                            >
                              Set
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* TAB 2: LIVE RAW FISH PACKETS */}
                <TabsContent value="raw_packets" className="mt-4 space-y-4">
                  <div className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/30 space-y-3">
                    <div className="text-xs font-bold text-[#5EEAD4] flex items-center gap-1.5">
                      <PackagePlus className="h-4 w-4" /> Log New Weighed Raw Fish Packet
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-[11px] text-slate-300">Weight (kg) *</Label>
                        <Input
                          type="number"
                          step="0.05"
                          min="0.1"
                          placeholder="e.g. 1.35"
                          value={newWeightKg}
                          onChange={(e) => setNewWeightKg(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-300">
                          Price/kg (Default: {activeBranch?.raw_price_per_kg || 450})
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder={String(activeBranch?.raw_price_per_kg || 450)}
                          value={customPricePerKg}
                          onChange={(e) => setCustomPricePerKg(e.target.value)}
                          className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                        />
                      </div>
                    </div>
                    {newWeightKg && !isNaN(parseFloat(newWeightKg)) && (
                      <div className="text-xs text-[#5EEAD4] font-semibold">
                        Calculated Packet Value: KES{' '}
                        {Math.round(
                          parseFloat(newWeightKg) *
                            (customPricePerKg ? parseFloat(customPricePerKg) : activeBranch?.raw_price_per_kg || 450)
                        ).toLocaleString()}
                      </div>
                    )}
                    <Button
                      type="button"
                      onClick={handleCreateRawPacket}
                      className="w-full h-8 bg-[#14B8A6] text-[#013333] font-bold text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Packet to Live Stock
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {availableRawPackets.map((pkt) => (
                      <div
                        key={pkt.id}
                        className="p-2.5 rounded-lg bg-[#014D4D]/60 border border-[#14B8A6]/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-[#5EEAD4]">{pkt.packet_code}</span>
                            <span>{pkt.weight_kg} kg</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            KES {pkt.total_price.toLocaleString()} (@ {pkt.selling_price_per_kg}/kg)
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markRawPacketSpoiled(pkt.id)}
                          className="text-rose-400 hover:text-rose-300 h-7 text-[11px]"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* TAB 3: ACTIVE DELIVERIES */}
                <TabsContent value="deliveries" className="mt-4 space-y-3">
                  {deliveries.slice(0, 12).map((del) => (
                    <div
                      key={del.id}
                      className="p-3 rounded-lg bg-[#014D4D]/70 border border-[#14B8A6]/20 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#5EEAD4]">{del.invoice_id}</span>
                        <Badge
                          variant="outline"
                          className={
                            del.status === 'out_for_delivery'
                              ? 'border-amber-400/40 text-amber-300 text-[10px]'
                              : 'border-emerald-400/40 text-emerald-300 text-[10px]'
                          }
                        >
                          {del.status.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-white font-semibold">
                        {del.customer_name} ({del.customer_phone})
                      </div>
                      <div className="text-[11px] text-[#94A3B8]">{del.delivery_address}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-[#14B8A6]/10">
                        <span>Courier: {del.courier_name}</span>
                        <span>
                          Fee: KES {del.delivery_fee_charged} | Payout: KES {del.courier_payout}
                        </span>
                      </div>
                      {del.status === 'out_for_delivery' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            updateDeliveryStatus(del.id, 'delivered');
                            toast.success(`Order ${del.invoice_id} marked as Delivered!`);
                          }}
                          className="w-full h-7 bg-emerald-500 hover:bg-emerald-400 text-[#013333] font-bold text-xs mt-1"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Delivered
                        </Button>
                      )}
                    </div>
                  ))}
                  {deliveries.length === 0 && (
                    <div className="text-center py-8 text-xs text-[#94A3B8]">
                      No delivery dispatches logged yet.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* END OF DAY (EOD) CLOSE SHIFT MODAL */}
      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <DialogContent className="bg-[#013333] border-[#14B8A6] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#5EEAD4] flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" /> End of Day (EOD) — Close Shift Ledger
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Reconcile physical Cash in Hand vs. M-Pesa for {activeBranch?.name} ({todayKey}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/30 text-center">
              <div>
                <div className="text-[11px] text-amber-300">System Cash</div>
                <div className="text-lg font-bold text-white">
                  KES {salesMetrics.todayCash.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-300">System M-Pesa</div>
                <div className="text-lg font-bold text-white">
                  KES {salesMetrics.todayMpesa.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#5EEAD4]">Total Sales ({salesMetrics.todayCount})</div>
                <div className="text-lg font-bold text-[#5EEAD4]">
                  KES {salesMetrics.todayTotal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-300">Declared Cash in Hand (KES)</Label>
                <Input
                  type="number"
                  value={declaredCash}
                  onChange={(e) => setDeclaredCash(e.target.value)}
                  className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-emerald-300">Confirmed M-Pesa Total (KES)</Label>
                <Input
                  type="number"
                  value={declaredMpesa}
                  onChange={(e) => setDeclaredMpesa(e.target.value)}
                  className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#94A3B8]">Shift Handover / Variance Notes</Label>
              <Input
                placeholder="Optional notes on cash float, courier payouts, etc."
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCloseShiftOpen(false)} className="text-[#94A3B8]">
              Cancel
            </Button>
            <Button
              disabled={isClosingShift}
              onClick={handleConfirmCloseShift}
              className="bg-amber-500 hover:bg-amber-600 text-[#013333] font-bold"
            >
              {isClosingShift ? 'Closing Shift...' : 'Confirm & Close Daily Ledger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SellerPOS;

