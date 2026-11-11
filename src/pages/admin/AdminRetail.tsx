import { useState, useMemo } from 'react';
import { useRetail, FriedFishPriceGroup } from '@/contexts/RetailContext';
import { SellerPOS } from '@/pages/retail/SellerPOS';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Store,
  Flame,
  Scale,
  TrendingUp,
  BarChart3,
  Truck,
  DollarSign,
  Plus,
  ArrowRight,
  Building2,
  Settings2,
  CheckCircle2,
  Layers,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { toast } from 'sonner';

const CHART_COLORS = ['#14B8A6', '#F59E0B', '#38BDF8', '#A855F7', '#F43F5E', '#10B981'];

export default function AdminRetail() {
  const {
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
    addBranch,
    updateBranchRates,
    saveFriedPriceGroup,
    updateDeliveryStatus,
    convertRawToFried,
    syncHistoricalFishSales,
  } = useRetail();

  const [isSyncingPastSales, setIsSyncingPastSales] = useState(false);

  const handleSyncPastFishSales = async () => {
    setIsSyncingPastSales(true);
    try {
      const res = await syncHistoricalFishSales();
      toast.success(
        res.synced > 0
          ? `Populated ${res.synced} historical fish sales into the Retail Hub (Excluded ${res.skipped} non-fish records)!`
          : `All past fish sales are already populated in the Retail Hub (${res.skipped} non-fish records excluded).`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync historical fish sales');
    } finally {
      setIsSyncingPastSales(false);
    }
  };

  // --- CONVERSION STUDIO STATE ---
  const [selectedConversionRawIds, setSelectedConversionRawIds] = useState<string[]>([]);
  const [conversionOutputs, setConversionOutputs] = useState<Record<string, number>>({});
  const [conversionNotes, setConversionNotes] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  // --- ADD BRANCH MODAL STATE ---
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchRawPrice, setNewBranchRawPrice] = useState(450);
  const [newBranchRawCost, setNewBranchRawCost] = useState(300);

  // --- PRICE GROUP / RATES CONFIG MODAL STATE ---
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FriedFishPriceGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupSizeLabel, setGroupSizeLabel] = useState('');
  const [groupUnitPrice, setGroupUnitPrice] = useState(250);
  const [groupUnitCost, setGroupUnitCost] = useState(150);

  const [branchRawSellRate, setBranchRawSellRate] = useState<number>(activeBranch?.raw_price_per_kg || 450);
  const [branchRawCostRate, setBranchRawCostRate] = useState<number>(activeBranch?.raw_cost_per_kg || 300);

  const availableRawPackets = useMemo(
    () => rawPackets.filter((p) => p.status === 'available'),
    [rawPackets]
  );

  // --- CONVERSION CALCULATIONS ---
  const conversionPreview = useMemo(() => {
    const selectedPackets = availableRawPackets.filter((p) => selectedConversionRawIds.includes(p.id));
    const totalWeightKg = selectedPackets.reduce((s, p) => s + (Number(p.weight_kg) || 0), 0);
    const baselineRawRevenue = selectedPackets.reduce((s, p) => s + (Number(p.total_price) || 0), 0);
    const rawCostBasis = selectedPackets.reduce((s, p) => s + (Number(p.total_cost) || 0), 0);

    let totalPieces = 0;
    let expectedFriedRevenue = 0;

    friedStock.forEach((g) => {
      const count = Number(conversionOutputs[g.id]) || 0;
      if (count > 0) {
        totalPieces += count;
        expectedFriedRevenue += count * g.unit_price;
      }
    });

    const uplift = expectedFriedRevenue - baselineRawRevenue;
    const expectedGrossMargin = expectedFriedRevenue - rawCostBasis;
    const yieldPerKg = totalWeightKg > 0 ? (totalPieces / totalWeightKg).toFixed(2) : '0.00';

    return {
      selectedPackets,
      totalWeightKg,
      baselineRawRevenue,
      rawCostBasis,
      totalPieces,
      expectedFriedRevenue,
      uplift,
      expectedGrossMargin,
      yieldPerKg,
    };
  }, [availableRawPackets, selectedConversionRawIds, conversionOutputs, friedStock]);

  const handleToggleConversionPacket = (id: string) => {
    setSelectedConversionRawIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteConversion = async () => {
    if (selectedConversionRawIds.length === 0) {
      return toast.error('Select at least one available Raw Fish Packet to split.');
    }
    const outputsPayload = friedStock
      .map((g) => ({
        group_id: g.id,
        group_name: g.group_name,
        unit_price: g.unit_price,
        unit_cost_estimate: g.unit_cost_estimate,
        count_produced: Number(conversionOutputs[g.id]) || 0,
      }))
      .filter((o) => o.count_produced > 0);

    if (outputsPayload.length === 0) {
      return toast.error('Input the number of fried fish pieces yielded into at least one price group.');
    }

    setIsConverting(true);
    try {
      await convertRawToFried({
        raw_packet_ids: selectedConversionRawIds,
        outputs: outputsPayload,
        notes: conversionNotes.trim(),
      });
      toast.success(
        `Converted ${conversionPreview.totalWeightKg.toFixed(2)} kg Raw Fish into ${conversionPreview.totalPieces} Fried Fish pieces!`
      );
      setSelectedConversionRawIds([]);
      setConversionOutputs({});
      setConversionNotes('');
    } catch (err: any) {
      toast.error(err.message || 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  // --- FINANCIALS & ANALYTICS COMPUTATIONS ---
  const analytics = useMemo(() => {
    const validSales = retailSales.filter((s) => s.status === 'Paid');

    let totalRevenue = 0;
    let totalCash = 0;
    let totalMpesa = 0;
    let totalCogs = 0;
    let rawRevenue = 0;
    let rawUnitsSold = 0;
    let rawWeightSoldKg = 0;
    let friedRevenue = 0;
    let friedUnitsSold = 0;

    // Hourly buckets (06:00 to 22:00)
    const hourlyMap: Record<number, { hourLabel: string; revenue: number; orders: number }> = {};
    for (let h = 6; h <= 22; h++) {
      hourlyMap[h] = {
        hourLabel: `${String(h).padStart(2, '0')}:00`,
        revenue: 0,
        orders: 0,
      };
    }

    // Fried tier performance map
    const tierPerformance: Record<string, { name: string; units: number; revenue: number }> = {};
    friedStock.forEach((g) => {
      tierPerformance[g.group_name] = { name: `${g.group_name} (KES ${g.unit_price})`, units: 0, revenue: 0 };
    });

    validSales.forEach((sale) => {
      const amt = Number(sale.total || sale.amount) || 0;
      const cogs = Number(sale.cogs_total) || Math.round(amt * 0.62);
      totalRevenue += amt;
      totalCogs += cogs;

      if (sale.payment_method === 'M-Pesa') totalMpesa += amt;
      else totalCash += amt;

      const d = new Date(sale.created_at || sale.date);
      if (!isNaN(d.getTime())) {
        const hr = d.getHours();
        if (!hourlyMap[hr]) {
          hourlyMap[hr] = { hourLabel: `${String(hr).padStart(2, '0')}:00`, revenue: 0, orders: 0 };
        }
        hourlyMap[hr].revenue += amt;
        hourlyMap[hr].orders += 1;
      }

      if (Array.isArray(sale.line_items)) {
        sale.line_items.forEach((li) => {
          if (li.item_type === 'raw_packet') {
            rawRevenue += Number(li.subtotal) || 0;
            rawUnitsSold += Number(li.qty) || 1;
            rawWeightSoldKg += Number(li.weight_kg) || 0;
          } else if (li.item_type === 'fried_fish') {
            friedRevenue += Number(li.subtotal) || 0;
            friedUnitsSold += Number(li.qty) || 0;
            const grp = li.price_group_name || li.label;
            if (!tierPerformance[grp]) {
              tierPerformance[grp] = { name: grp, units: 0, revenue: 0 };
            }
            tierPerformance[grp].units += Number(li.qty) || 0;
            tierPerformance[grp].revenue += Number(li.subtotal) || 0;
          }
        });
      }
    });

    const grossProfit = totalRevenue - totalCogs;
    const grossMarginPct = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const hourlyData = Object.keys(hourlyMap)
      .map(Number)
      .sort((a, b) => a - b)
      .map((h) => hourlyMap[h]);

    let peakHour = { hourLabel: 'N/A', revenue: 0, orders: 0 };
    hourlyData.forEach((slot) => {
      if (slot.revenue > peakHour.revenue) peakHour = slot;
    });

    const productMixData = [
      { name: 'Fried Fish', value: friedRevenue },
      { name: 'Raw Fish Packets', value: rawRevenue },
    ].filter((d) => d.value > 0);

    const tierBreakdown = Object.values(tierPerformance);

    // Delivery Economics
    const validDeliveries = deliveries.filter((d) => d.status !== 'cancelled');
    const totalDeliveryFees = validDeliveries.reduce((s, d) => s + (Number(d.delivery_fee_charged) || 0), 0);
    const totalCourierPayouts = validDeliveries.reduce((s, d) => s + (Number(d.courier_payout) || 0), 0);
    const netDeliveryProfit = totalDeliveryFees - totalCourierPayouts;

    return {
      totalRevenue,
      totalCash,
      totalMpesa,
      totalCogs,
      grossProfit,
      grossMarginPct,
      rawRevenue,
      rawUnitsSold,
      rawWeightSoldKg,
      friedRevenue,
      friedUnitsSold,
      hourlyData,
      peakHour,
      productMixData,
      tierBreakdown,
      totalDeliveriesCount: validDeliveries.length,
      totalDeliveryFees,
      totalCourierPayouts,
      netDeliveryProfit,
    };
  }, [retailSales, friedStock, deliveries]);

  // --- ADMIN CONFIG HANDLERS ---
  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return toast.error('Enter a branch name');
    try {
      await addBranch({
        name: newBranchName.trim(),
        location: newBranchLocation.trim() || 'Kenya',
        raw_price_per_kg: Number(newBranchRawPrice) || 450,
        raw_cost_per_kg: Number(newBranchRawCost) || 300,
      });
      toast.success(`Branch "${newBranchName}" created and activated!`);
      setNewBranchName('');
      setNewBranchLocation('');
      setIsAddBranchOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add branch');
    }
  };

  const handleSavePriceGroup = async () => {
    if (!groupName.trim() || groupUnitPrice <= 0) {
      return toast.error('Provide a valid group name and unit price.');
    }
    try {
      await saveFriedPriceGroup({
        id: editingGroup?.id,
        group_name: groupName.trim(),
        size_label: groupSizeLabel.trim() || `${groupName.trim()} Size`,
        unit_price: Number(groupUnitPrice),
        unit_cost_estimate: Number(groupUnitCost) || Math.round(Number(groupUnitPrice) * 0.62),
      });
      toast.success(`Saved Fried Fish price group "${groupName}"`);
      setEditingGroup(null);
      setGroupName('');
      setGroupSizeLabel('');
      setIsConfigOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save price group');
    }
  };

  const handleSaveBranchRates = async () => {
    if (!activeBranch) return;
    try {
      await updateBranchRates(activeBranch.id, Number(branchRawSellRate) || 450, Number(branchRawCostRate) || 300);
      toast.success(`Updated ${activeBranch.name} Raw Fish rates!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update branch rates');
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP COMMAND HEADER WITH MULTI-BRANCH SELECTOR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Store className="h-8 w-8 text-[#14B8A6]" />
            <h1 className="text-3xl font-bold text-[#14B8A6]">Admin Retail Command Center</h1>
          </div>
          <p className="text-[#94A3B8]">
            Multi-branch POS, Raw-to-Fried conversion yield studio, retail margins, peak hours, and delivery unit economics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#013333] px-3 py-1.5 rounded-lg border border-[#14B8A6]/30">
            <Building2 className="h-4 w-4 text-[#14B8A6]" />
            <span className="text-xs text-[#94A3B8]">Branch:</span>
            <Select value={activeBranchId} onValueChange={setActiveBranchId}>
              <SelectTrigger className="w-[165px] bg-[#014D4D] border-[#14B8A6]/30 text-white h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={isSyncingPastSales}
            onClick={handleSyncPastFishSales}
            className="border-[#14B8A6]/40 text-[#5EEAD4] hover:bg-[#14B8A6]/10 h-9"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isSyncingPastSales ? 'animate-spin' : ''}`} />
            {isSyncingPastSales ? 'Syncing Fish Sales...' : 'Sync Past Fish Sales'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddBranchOpen(true)}
            className="border-[#14B8A6]/40 text-[#5EEAD4] hover:bg-[#14B8A6]/10 h-9"
          >
            <Plus className="h-4 w-4 mr-1" /> New Branch
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingGroup(null);
              setGroupName('');
              setGroupSizeLabel('');
              setGroupUnitPrice(250);
              setGroupUnitCost(150);
              setBranchRawSellRate(activeBranch?.raw_price_per_kg || 450);
              setBranchRawCostRate(activeBranch?.raw_cost_per_kg || 300);
              setIsConfigOpen(true);
            }}
            className="border-[#14B8A6]/40 text-[#5EEAD4] hover:bg-[#14B8A6]/10 h-9"
          >
            <Settings2 className="h-4 w-4 mr-1" /> Pricing & Tiers
          </Button>
        </div>
      </div>

      {/* EXECUTIVE KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#013333] border-[#14B8A6]/30">
          <CardContent className="p-5">
            <div className="flex justify-between items-center text-xs text-[#94A3B8]">
              <span>Branch Retail Revenue</span>
              <DollarSign className="h-4 w-4 text-[#14B8A6]" />
            </div>
            <div className="text-2xl font-extrabold text-[#5EEAD4] mt-1">
              KES {analytics.totalRevenue.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1.5 flex justify-between">
              <span className="text-amber-300">Cash: {analytics.totalCash.toLocaleString()}</span>
              <span className="text-emerald-300">M-Pesa: {analytics.totalMpesa.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/30">
          <CardContent className="p-5">
            <div className="flex justify-between items-center text-xs text-[#94A3B8]">
              <span>Gross Profit & Margin</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1">
              KES {analytics.grossProfit.toLocaleString()}
            </div>
            <div className="text-xs text-[#5EEAD4] mt-1.5">
              {analytics.grossMarginPct}% Gross Margin (COGS: KES {analytics.totalCogs.toLocaleString()})
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/30">
          <CardContent className="p-5">
            <div className="flex justify-between items-center text-xs text-[#94A3B8]">
              <span>Live Branch Stock</span>
              <Layers className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1">
              {friedStock.reduce((s, g) => s + (Number(g.quantity_available) || 0), 0)} Fried •{' '}
              {availableRawPackets.length} Raw
            </div>
            <div className="text-xs text-[#94A3B8] mt-1.5">
              Raw Weight: {availableRawPackets.reduce((s, p) => s + p.weight_kg, 0).toFixed(2)} kg available
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]/30">
          <CardContent className="p-5">
            <div className="flex justify-between items-center text-xs text-[#94A3B8]">
              <span>Delivery Unit Economics</span>
              <Truck className="h-4 w-4 text-amber-400" />
            </div>
            <div
              className={`text-2xl font-extrabold mt-1 ${
                analytics.netDeliveryProfit >= 0 ? 'text-[#5EEAD4]' : 'text-rose-400'
              }`}
            >
              {analytics.netDeliveryProfit >= 0 ? '+' : ''}KES {analytics.netDeliveryProfit.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Fees: {analytics.totalDeliveryFees.toLocaleString()} | Payouts:{' '}
              {analytics.totalCourierPayouts.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MAIN ADMIN TABS */}
      <Tabs defaultValue="pos" className="w-full">
        <TabsList className="bg-[#013333] border border-[#14B8A6]/30 flex flex-wrap h-auto p-1">
          <TabsTrigger
            value="pos"
            className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] font-bold"
          >
            POS & Live Inventory
          </TabsTrigger>
          <TabsTrigger
            value="conversion"
            className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] font-bold"
          >
            Raw-to-Fried Conversion
          </TabsTrigger>
          <TabsTrigger
            value="financials"
            className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] font-bold"
          >
            Branch Financials & Shifts
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] font-bold"
          >
            Peak Hours & Product Analytics
          </TabsTrigger>
          <TabsTrigger
            value="deliveries"
            className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333] font-bold"
          >
            Delivery Unit Economics
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FULL SELLER POS VIEW EMBEDDED */}
        <TabsContent value="pos" className="mt-6">
          <SellerPOS embeddedInAdmin={true} />
        </TabsContent>

        {/* TAB 2: ADMIN RAW-TO-FRIED CONVERSION STUDIO */}
        <TabsContent value="conversion" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step 1: Select Raw Packets */}
            <Card className="lg:col-span-5 bg-[#013333] border-[#14B8A6]/30">
              <CardHeader>
                <CardTitle className="text-[#5EEAD4] flex items-center gap-2 text-lg">
                  <Scale className="h-5 w-5 text-cyan-400" /> 1. Select Raw Fish Packet(s) to Split
                </CardTitle>
                <CardDescription className="text-[#94A3B8]">
                  Choose one or more weighed raw fish packets to convert into fried inventory.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableRawPackets.length === 0 ? (
                  <div className="text-center py-8 text-sm text-[#94A3B8] border border-dashed border-[#14B8A6]/20 rounded-lg">
                    No available raw packets in stock. Add weighed packets in the POS tab first.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                    {availableRawPackets.map((pkt) => {
                      const selected = selectedConversionRawIds.includes(pkt.id);
                      return (
                        <button
                          key={pkt.id}
                          type="button"
                          onClick={() => handleToggleConversionPacket(pkt.id)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            selected
                              ? 'bg-[#14B8A6] text-[#013333] border-white font-bold'
                              : 'bg-[#014D4D] text-white border-[#14B8A6]/30 hover:border-[#14B8A6]'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-xs">{pkt.packet_code}</span>
                            <span className="text-xs font-extrabold">{pkt.weight_kg} kg</span>
                          </div>
                          <div className="text-xs mt-1 opacity-90">
                            Raw Value: KES {pkt.total_price.toLocaleString()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2 & 3: Fried Fish Price Group Allocation & Yield Preview */}
            <Card className="lg:col-span-7 bg-[#013333] border-[#14B8A6]/30">
              <CardHeader>
                <CardTitle className="text-[#5EEAD4] flex items-center gap-2 text-lg">
                  <Flame className="h-5 w-5 text-orange-400" /> 2. Allocate Fried Fish Yield by Price Tier
                </CardTitle>
                <CardDescription className="text-[#94A3B8]">
                  Enter how many pieces were produced per Fried Fish price group to track yield and expected revenue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {friedStock.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/30 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-white text-sm">
                          {group.group_name} (KES {group.unit_price})
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">
                          Current Stock: {group.quantity_available} pcs
                        </div>
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          min="0"
                          placeholder="0 pcs"
                          value={conversionOutputs[group.id] || ''}
                          onChange={(e) =>
                            setConversionOutputs((prev) => ({
                              ...prev,
                              [group.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            }))
                          }
                          className="bg-[#013333] border-[#14B8A6]/40 text-white text-center font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live Yield & Expected Revenue Summary Box */}
                <div className="p-4 rounded-lg bg-[#014D4D]/70 border border-[#14B8A6]/40 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Input Raw Weight</div>
                    <div className="text-lg font-extrabold text-white">
                      {conversionPreview.totalWeightKg.toFixed(2)} kg
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Raw Val: KES {conversionPreview.baselineRawRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Fried Yield</div>
                    <div className="text-lg font-extrabold text-[#5EEAD4]">
                      {conversionPreview.totalPieces} pcs
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {conversionPreview.yieldPerKg} pcs / kg
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Expected Fried Rev</div>
                    <div className="text-lg font-extrabold text-emerald-400">
                      KES {conversionPreview.expectedFriedRevenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Est Margin: KES {conversionPreview.expectedGrossMargin.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#94A3B8]">Value Uplift (vs Raw)</div>
                    <div
                      className={`text-lg font-extrabold ${
                        conversionPreview.uplift >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {conversionPreview.uplift >= 0 ? '+' : ''}KES {conversionPreview.uplift.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">Frying value-add</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-[#94A3B8]">Batch / Yield Notes (Optional)</Label>
                  <Input
                    placeholder="e.g. Morning frying batch from Pond A2 harvest"
                    value={conversionNotes}
                    onChange={(e) => setConversionNotes(e.target.value)}
                    className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
                  />
                </div>

                <Button
                  type="button"
                  disabled={isConverting || selectedConversionRawIds.length === 0 || conversionPreview.totalPieces === 0}
                  onClick={handleExecuteConversion}
                  className="w-full h-11 bg-[#14B8A6] hover:bg-[#5EEAD4] text-[#013333] font-extrabold text-sm gap-2"
                >
                  <Flame className="h-4 w-4" />
                  {isConverting
                    ? 'Splitting Raw Packet into Fried Stock...'
                    : 'Commit Raw-to-Fried Conversion & Update Stock'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Historical Conversion Yield Log */}
          <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] text-lg">Conversion & Yield Ledger</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                Historical audit log of Raw-to-Fried packet conversions, piece yields, and expected revenue uplift.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]/20">
                    <TableHead className="text-[#14B8A6]">Date</TableHead>
                    <TableHead className="text-[#14B8A6]">Raw Packets</TableHead>
                    <TableHead className="text-[#14B8A6]">Raw Weight</TableHead>
                    <TableHead className="text-[#14B8A6]">Fried Output Breakdown</TableHead>
                    <TableHead className="text-[#14B8A6]">Yield</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Expected Revenue</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Value Uplift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversions.map((c) => (
                    <TableRow key={c.id} className="border-[#14B8A6]/10">
                      <TableCell className="text-slate-300 text-xs">
                        {new Date(c.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-[#5EEAD4]">
                        {(c.raw_packet_codes || []).join(', ')}
                      </TableCell>
                      <TableCell className="text-white font-semibold">{c.total_raw_weight_kg} kg</TableCell>
                      <TableCell className="text-xs text-slate-300">
                        {c.outputs.map((o) => `${o.count_produced}x ${o.group_name} (@${o.unit_price})`).join(', ')}
                      </TableCell>
                      <TableCell className="text-xs text-[#5EEAD4]">
                        {c.total_pieces_produced} pcs ({c.yield_pieces_per_kg}/kg)
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-400">
                        KES {c.total_expected_fried_revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-[#5EEAD4]">
                        {c.expected_value_uplift >= 0 ? '+' : ''}KES {c.expected_value_uplift.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {conversions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No Raw-to-Fried conversions recorded for this branch yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: BRANCH FINANCIALS & SHIFT RECONCILIATION */}
        <TabsContent value="financials" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-5">
                <div className="text-xs text-amber-300 font-semibold">Cash in Hand (Retail POS)</div>
                <div className="text-3xl font-bold text-white mt-1">
                  KES {analytics.totalCash.toLocaleString()}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Net after courier payouts: KES {(analytics.totalCash - analytics.totalCourierPayouts).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-5">
                <div className="text-xs text-emerald-300 font-semibold">M-Pesa Collections</div>
                <div className="text-3xl font-bold text-white mt-1">
                  KES {analytics.totalMpesa.toLocaleString()}
                </div>
                <p className="text-xs text-slate-300 mt-1">Digital mobile money settlements</p>
              </CardContent>
            </Card>
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-5">
                <div className="text-xs text-[#5EEAD4] font-semibold">Branch Gross Margin</div>
                <div className="text-3xl font-bold text-[#5EEAD4] mt-1">
                  KES {analytics.grossProfit.toLocaleString()} ({analytics.grossMarginPct}%)
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Revenue: {analytics.totalRevenue.toLocaleString()} • COGS: {analytics.totalCogs.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Multi-Branch Comparison Summary */}
          <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] text-lg">End of Day (EOD) Shift Reconciliations</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                Daily shift closures comparing system-tallied Cash & M-Pesa against seller declarations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]/20">
                    <TableHead className="text-[#14B8A6]">Shift Date</TableHead>
                    <TableHead className="text-[#14B8A6]">Closed By</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">System Cash</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Declared Cash</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">System M-Pesa</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Confirmed M-Pesa</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((sh) => {
                    const totalVar = (Number(sh.cash_variance) || 0) + (Number(sh.mpesa_variance) || 0);
                    return (
                      <TableRow key={sh.id} className="border-[#14B8A6]/10">
                        <TableCell className="font-mono text-white">{sh.date_key}</TableCell>
                        <TableCell className="text-slate-300">{sh.closed_by_name}</TableCell>
                        <TableCell className="text-right text-amber-300">
                          KES {sh.system_cash_total.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          KES {sh.declared_cash.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-emerald-300">
                          KES {sh.system_mpesa_total.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-white">
                          KES {sh.declared_mpesa.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            totalVar === 0 ? 'text-emerald-400' : totalVar > 0 ? 'text-cyan-400' : 'text-rose-400'
                          }`}
                        >
                          {totalVar >= 0 ? '+' : ''}KES {totalVar.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No EOD shifts closed yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PEAK HOURS & PRODUCT PERFORMANCE ANALYTICS */}
        <TabsContent value="analytics" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Peak Sales Hours Chart */}
            <Card className="lg:col-span-7 bg-[#013333] border-[#14B8A6]/20">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-[#5EEAD4] flex items-center gap-2 text-lg">
                      <BarChart3 className="h-5 w-5" /> Peak Sales Hours (EAT)
                    </CardTitle>
                    <CardDescription className="text-[#94A3B8]">
                      Hourly revenue distribution across the day.
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#014D4D] text-[#5EEAD4] border-[#14B8A6]/40">
                    Peak Hour: {analytics.peakHour.hourLabel} (KES {analytics.peakHour.revenue.toLocaleString()})
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#14B8A6" opacity={0.15} />
                    <XAxis dataKey="hourLabel" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: '#14B8A6',
                        color: 'hsl(var(--foreground))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" name="Revenue (KES)" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Product Performance: Raw vs Fried */}
            <Card className="lg:col-span-5 bg-[#013333] border-[#14B8A6]/20">
              <CardHeader>
                <CardTitle className="text-[#5EEAD4] text-lg">Product Performance: Raw vs. Fried</CardTitle>
                <CardDescription className="text-[#94A3B8]">
                  Revenue contribution and volume by product category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-44">
                  {analytics.productMixData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No sales data yet
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.productMixData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={4}
                        >
                          {analytics.productMixData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderColor: '#14B8A6',
                            color: 'hsl(var(--foreground))',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/20">
                    <div className="text-[#5EEAD4] font-bold">Fried Fish Sold</div>
                    <div className="text-lg font-extrabold text-white mt-0.5">
                      KES {analytics.friedRevenue.toLocaleString()}
                    </div>
                    <div className="text-slate-400">{analytics.friedUnitsSold} pieces sold</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/20">
                    <div className="text-amber-300 font-bold">Raw Packets Sold</div>
                    <div className="text-lg font-extrabold text-white mt-0.5">
                      KES {analytics.rawRevenue.toLocaleString()}
                    </div>
                    <div className="text-slate-400">
                      {analytics.rawUnitsSold} pkts ({analytics.rawWeightSoldKg.toFixed(2)} kg)
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Size Category Performance Table */}
          <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] text-lg">Fried Fish Price Tier Performance</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                Units sold and revenue generated per size category.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]/20">
                    <TableHead className="text-[#14B8A6]">Size / Price Category</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Units Sold (pcs)</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Revenue Generated (KES)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.tierBreakdown.map((tier) => (
                    <TableRow key={tier.name} className="border-[#14B8A6]/10">
                      <TableCell className="font-bold text-white">{tier.name}</TableCell>
                      <TableCell className="text-right text-[#5EEAD4] font-semibold">{tier.units}</TableCell>
                      <TableCell className="text-right text-emerald-400 font-bold">
                        KES {tier.revenue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: DELIVERY UNIT ECONOMICS */}
        <TabsContent value="deliveries" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-4">
                <div className="text-xs text-slate-300">Dispatched Orders</div>
                <div className="text-2xl font-bold text-white mt-1">{analytics.totalDeliveriesCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-4">
                <div className="text-xs text-emerald-300">Delivery Fees Charged</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  KES {analytics.totalDeliveryFees.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-4">
                <div className="text-xs text-rose-300">Courier Payouts</div>
                <div className="text-2xl font-bold text-rose-400 mt-1">
                  KES {analytics.totalCourierPayouts.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#014D4D] border-[#14B8A6]/30">
              <CardContent className="p-4">
                <div className="text-xs text-[#5EEAD4]">Net Delivery Profit / Subsidy</div>
                <div
                  className={`text-2xl font-bold mt-1 ${
                    analytics.netDeliveryProfit >= 0 ? 'text-[#5EEAD4]' : 'text-rose-400'
                  }`}
                >
                  {analytics.netDeliveryProfit >= 0 ? '+' : ''}KES {analytics.netDeliveryProfit.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] text-lg">Delivery Dispatch & Unit Economics Ledger</CardTitle>
              <CardDescription className="text-[#94A3B8]">
                Track every customer delivery, courier assignment, delivery revenue vs. rider payout, and net margin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]/20">
                    <TableHead className="text-[#14B8A6]">Invoice</TableHead>
                    <TableHead className="text-[#14B8A6]">Customer & Destination</TableHead>
                    <TableHead className="text-[#14B8A6]">Courier</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Fee Charged</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Courier Payout</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Net Margin</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((del) => (
                    <TableRow key={del.id} className="border-[#14B8A6]/10">
                      <TableCell className="font-mono text-xs text-[#5EEAD4]">{del.invoice_id}</TableCell>
                      <TableCell>
                        <div className="text-xs font-bold text-white">
                          {del.customer_name} ({del.customer_phone})
                        </div>
                        <div className="text-[11px] text-slate-400">{del.delivery_address}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-200">
                        {del.courier_name} {del.courier_phone ? `(${del.courier_phone})` : ''}
                      </TableCell>
                      <TableCell className="text-right text-emerald-400 font-semibold">
                        KES {del.delivery_fee_charged.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-rose-400 font-semibold">
                        KES {del.courier_payout.toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${
                          del.net_delivery_profit >= 0 ? 'text-[#5EEAD4]' : 'text-rose-400'
                        }`}
                      >
                        {del.net_delivery_profit >= 0 ? '+' : ''}KES {del.net_delivery_profit.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {del.status === 'out_for_delivery' ? (
                          <Button
                            size="sm"
                            onClick={() => updateDeliveryStatus(del.id, 'delivered')}
                            className="h-7 bg-emerald-500 text-[#013333] font-bold text-xs"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Delivered
                          </Button>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            {del.status.toUpperCase()}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {deliveries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        No deliveries recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: CREATE NEW BRANCH */}
      <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
        <DialogContent className="bg-[#013333] border-[#14B8A6] text-white">
          <DialogHeader>
            <DialogTitle className="text-[#5EEAD4]">Add New Retail Branch</DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Scale operations by adding a new retail branch with its own inventory, shifts, and P&L tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-[#94A3B8]">Branch Name *</Label>
              <Input
                placeholder="e.g. Nairobi West Branch"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-[#94A3B8]">Location</Label>
              <Input
                placeholder="e.g. Nairobi"
                value={newBranchLocation}
                onChange={(e) => setNewBranchLocation(e.target.value)}
                className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#94A3B8]">Raw Fish Selling Price/kg (KES)</Label>
                <Input
                  type="number"
                  value={newBranchRawPrice}
                  onChange={(e) => setNewBranchRawPrice(Number(e.target.value))}
                  className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
                />
              </div>
              <div>
                <Label className="text-xs text-[#94A3B8]">Raw Fish Cost Basis/kg (KES)</Label>
                <Input
                  type="number"
                  value={newBranchRawCost}
                  onChange={(e) => setNewBranchRawCost(Number(e.target.value))}
                  className="bg-[#014D4D] border-[#14B8A6]/30 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddBranchOpen(false)} className="text-[#94A3B8]">
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} className="bg-[#14B8A6] text-[#013333] font-bold">
              Create Branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CONFIGURE RATES & FRIED FISH PRICE TIERS */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="bg-[#013333] border-[#14B8A6] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#5EEAD4]">
              Branch Rates & Fried Fish Price Groups ({activeBranch?.name})
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Configure default Raw Fish per-kg rates or add/edit Fried Fish price categories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/30 space-y-3">
              <div className="text-xs font-bold text-[#5EEAD4]">Default Raw Fish Rates (KES / kg)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-300">Selling Price / kg</Label>
                  <Input
                    type="number"
                    value={branchRawSellRate}
                    onChange={(e) => setBranchRawSellRate(Number(e.target.value))}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-300">Cost Basis / kg (for Margin)</Label>
                  <Input
                    type="number"
                    value={branchRawCostRate}
                    onChange={(e) => setBranchRawCostRate(Number(e.target.value))}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSaveBranchRates}
                className="w-full h-8 bg-[#14B8A6] text-[#013333] font-bold text-xs"
              >
                Update Raw Fish Rates
              </Button>
            </div>

            <div className="p-3 rounded-lg bg-[#014D4D] border border-[#14B8A6]/30 space-y-3">
              <div className="text-xs font-bold text-[#5EEAD4]">
                {editingGroup ? `Edit Tier: ${editingGroup.group_name}` : 'Add New Fried Fish Price Group'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-slate-300">Group Name *</Label>
                  <Input
                    placeholder="e.g. Extra Large"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-300">Size Label</Label>
                  <Input
                    placeholder="e.g. 600g - 750g"
                    value={groupSizeLabel}
                    onChange={(e) => setGroupSizeLabel(e.target.value)}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-300">Selling Price (KES) *</Label>
                  <Input
                    type="number"
                    value={groupUnitPrice}
                    onChange={(e) => setGroupUnitPrice(Number(e.target.value))}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-300">Est. Unit Cost (KES)</Label>
                  <Input
                    type="number"
                    value={groupUnitCost}
                    onChange={(e) => setGroupUnitCost(Number(e.target.value))}
                    className="bg-[#013333] border-[#14B8A6]/30 text-white h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {editingGroup && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingGroup(null);
                      setGroupName('');
                      setGroupSizeLabel('');
                    }}
                    className="h-8 text-xs text-slate-300"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSavePriceGroup}
                  className="flex-1 h-8 bg-[#14B8A6] text-[#013333] font-bold text-xs"
                >
                  {editingGroup ? 'Save Tier Changes' : 'Add Fried Price Group'}
                </Button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#14B8A6]/20 max-h-36 overflow-y-auto">
                {friedStock.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-xs text-slate-200 py-1">
                    <span>
                      <strong>{g.group_name}</strong> — KES {g.unit_price} (Cost: KES {g.unit_cost_estimate})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingGroup(g);
                        setGroupName(g.group_name);
                        setGroupSizeLabel(g.size_label);
                        setGroupUnitPrice(g.unit_price);
                        setGroupUnitCost(g.unit_cost_estimate);
                      }}
                      className="h-6 text-[11px] text-[#5EEAD4]"
                    >
                      Edit
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

