import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { useData } from '@/contexts/DataContext';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
  Scale,
  Timer,
  Layers,
  Clock,
  Plus,
  Trash2,
  Settings2,
  Package,
  Save,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';

interface ScheduleSlot {
  id: string;
  hour: number;          // 0 - 23 (24-hour format)
  grams: number;         // Feed quantity in grams
  durationMs: number;    // Calculated: grams * (1000 / rate)
  feedInventoryId: string; // Associated inventory feed document
  feedName?: string;
}

interface FeederConfig {
  dispenseRateGps: number;       // Default: 8 g/s
  hopperEmptyDistanceCm: number; // e.g., 100 cm
  hopperFullDistanceCm: number;  // e.g., 15 cm
  hopperCapacityKg: number;      // e.g., 15 kg
  calibrationMs: number;         // Global fallback motor runtime (e.g., 4000 ms)
}

const DEFAULT_CONFIG: FeederConfig = {
  dispenseRateGps: 8,
  hopperEmptyDistanceCm: 100,
  hopperFullDistanceCm: 15,
  hopperCapacityKg: 15,
  calibrationMs: 4000,
};

interface FeedOption {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status?: string;
  gramsPerUnit: number | null; // null => non-weight unit (e.g. bags), cannot be auto-deducted
  availableGrams: number;
}

interface ManualFeedState {
  request_id?: string;
  status?: 'queued' | 'dispatched' | 'feeding' | 'completed' | 'deducted' | 'completed_no_deduction' | 'dispatched_no_deduction';
  estimated_grams?: number;
  feed_inventory_id?: string;
  feed_name?: string;
  final_distance_cm?: number;
  deduction?: { deducted: boolean; change?: number; unit?: string; reason?: string; insufficient_stock?: boolean };
}

// Must stay in sync with gramsPerUnit() in aquagen-server/controllers/feeder.js
const gramsPerUnit = (unit: string): number | null => {
  const u = String(unit || '').trim().toLowerCase();
  if (['kg', 'kgs', 'kilogram', 'kilograms', 'kilo', 'kilos'].includes(u)) return 1000;
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) return 1;
  if (['t', 'ton', 'tons', 'tonne', 'tonnes'].includes(u)) return 1000000;
  return null;
};

const formatQty = (n: number) => Number(n.toFixed(3)).toString();

const AutomaticFeeding = () => {
  const [pondId, setPondId] = useState('POND_01');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<FeederConfig>(DEFAULT_CONFIG);

  // Manual Feed State
  const [manualMode, setManualMode] = useState<'grams' | 'ms'>('grams');
  const [manualGrams, setManualGrams] = useState<number>(200);
  const [manualMs, setManualMs] = useState<number>(4000);
  const [selectedManualFeedId, setSelectedManualFeedId] = useState<string>('');
  const [lastManualFeed, setLastManualFeed] = useState<ManualFeedState | null>(null);

  // Schedules state
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);

  // Inventory state: live from the shared Firestore listener (same source as the Inventory page)
  const { inventory } = useData();
  const inventoryItems = useMemo<FeedOption[]>(() => {
    return inventory
      .map(item => {
        const quantity = Number(item.quantity) || 0;
        const gpu = gramsPerUnit(item.unit);
        return {
          id: item.id,
          name: item.item_name || 'Unnamed item',
          quantity,
          unit: item.unit || '',
          status: item.status,
          gramsPerUnit: gpu,
          availableGrams: gpu ? quantity * gpu : 0,
        };
      })
      // Weight-based (deductible) items first, then alphabetical
      .sort((a, b) => (a.gramsPerUnit ? 0 : 1) - (b.gramsPerUnit ? 0 : 1) || a.name.localeCompare(b.name));
  }, [inventory]);

  const deductibleItems = useMemo(() => inventoryItems.filter(i => i.gramsPerUnit), [inventoryItems]);
  const selectedManualFeed = inventoryItems.find(i => i.id === selectedManualFeedId);

  // Calculate dynamic ms per gram based on dispense rate
  const msPerGram = useMemo(() => {
    return config.dispenseRateGps > 0 ? 1000 / config.dispenseRateGps : 125;
  }, [config.dispenseRateGps]);

  // Sync manual runtime when grams or rate change
  useEffect(() => {
    if (manualMode === 'grams') {
      setManualMs(Math.round(manualGrams * msPerGram));
    }
  }, [manualGrams, msPerGram, manualMode]);

  // 1. Keep the manual feed selection pointing at a real, deductible inventory item
  useEffect(() => {
    if (deductibleItems.length === 0) {
      if (selectedManualFeedId) setSelectedManualFeedId('');
      return;
    }
    if (!deductibleItems.some(i => i.id === selectedManualFeedId)) {
      setSelectedManualFeedId(deductibleItems[0].id);
    }
  }, [deductibleItems, selectedManualFeedId]);

  // 2. Fetch pond configuration and active schedule string from 'ponds' collection
  useEffect(() => {
    if (!pondId) return;

    const pondDocRef = doc(db, 'ponds', pondId);
    const unsubPond = onSnapshot(pondDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.feeder_config) {
          setConfig({ ...DEFAULT_CONFIG, ...data.feeder_config });
        }
        if (Array.isArray(data.schedules)) {
          setSchedules(data.schedules);
        }
        setLastManualFeed(data.last_manual_feed || null);
      } else {
        setLastManualFeed(null);
      }
    });

    return () => unsubPond();
  }, [pondId]);

  // 3. Listen to latest telemetry from 'feeder_telemetry'
  useEffect(() => {
    if (!pondId) return;

    const q = query(
      collection(db, 'feeder_telemetry'),
      where('pond_id', '==', pondId),
      orderBy('created_at', 'desc'),
      limit(1)
    );

    const unsubTelemetry = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setTelemetry(snapshot.docs[0].data());
      } else {
        setTelemetry(null);
      }
    });

    return () => unsubTelemetry();
  }, [pondId]);

  // Derived: Connection State based on 2-minute timeout & trigger_source
  const deviceStatus = useMemo<'disconnected' | 'running' | 'idle'>(() => {
    if (!telemetry?.created_at) return 'disconnected';
    const lastPing = telemetry.created_at.toDate
      ? telemetry.created_at.toDate().getTime()
      : new Date(telemetry.created_at).getTime();
    const isStale = Date.now() - lastPing > 2 * 60 * 1000;
    if (isStale) return 'disconnected';
    if (telemetry.trigger_source === 'START') return 'running';
    return 'idle';
  }, [telemetry]);

  // Derived: Hardware Action & Origin State (Protocol Table Logic & UI Mapping)
  const hardwareAction = useMemo(() => {
    if (!telemetry) return null;
    const source = String(telemetry.trigger_source || (telemetry.feed_triggered ? 'AUTO' : 'NONE')).toUpperCase();
    switch (source) {
      case 'START':
        return {
          title: 'Motor Spinning',
          description: 'Instant Start: Feeding cycle in progress on pond',
          badge: 'START',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
        };
      case 'WEB':
        return {
          title: 'Cycle Completed',
          description: 'Action Confirmation: Vercel manual web command executed',
          badge: 'WEB',
          color: 'text-teal-400 bg-teal-500/10 border-teal-500/30'
        };
      case 'AUTO':
        return {
          title: 'Cycle Completed',
          description: 'Action Confirmation: Node A RTC autonomous schedule executed',
          badge: 'AUTO',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        };
      case 'BTN':
        return {
          title: 'Cycle Completed',
          description: 'Action Confirmation: Physical manual button pressed on feeder',
          badge: 'BTN',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
        };
      case 'NONE':
      default:
        return {
          title: 'Volume Delta Synced',
          description: 'Ultrasonic volume delta update (>2.0 cm outside feed cycle)',
          badge: 'NONE',
          color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
        };
    }
  }, [telemetry]);

  // Derived: Feed Level Percentage and remaining weight
  const { percentage: feedPercentage, remainingKg } = useMemo(() => {
    if (!telemetry || telemetry.distance_cm === undefined) {
      return { percentage: 0, remainingKg: 0 };
    }
    const dist = Number(telemetry.distance_cm);
    const rawPct = ((config.hopperEmptyDistanceCm - dist) /
      (config.hopperEmptyDistanceCm - config.hopperFullDistanceCm)) * 100;
    const clamped = Math.max(0, Math.min(100, Math.round(rawPct)));
    const kg = Number(((clamped / 100) * config.hopperCapacityKg).toFixed(1));
    return { percentage: clamped, remainingKg: kg };
  }, [telemetry, config]);

  // Derived: RSSI signal level and color
  const rssiValue = telemetry?.rssi ?? -100;
  const signalBadge = useMemo(() => {
    if (deviceStatus === 'disconnected') return { label: 'Offline', color: 'text-zinc-500 bg-zinc-500/10' };
    if (rssiValue >= -75) return { label: `${rssiValue} dBm (Excellent)`, color: 'text-emerald-400 bg-emerald-500/10' };
    if (rssiValue >= -90) return { label: `${rssiValue} dBm (Good)`, color: 'text-teal-400 bg-teal-500/10' };
    return { label: `${rssiValue} dBm (Weak)`, color: 'text-amber-400 bg-amber-500/10' };
  }, [rssiValue, deviceStatus]);

  // Build the Steve-compliant "Hour=DurationMs" string (e.g. "9=4000,13=6000,17=4000")
  const compiledScheduleStr = useMemo(() => {
    return schedules
      .slice(0, 10) // Protocol supports up to 10 intervals[cite: 10]
      .sort((a, b) => a.hour - b.hour)
      .map(s => `${s.hour}=${s.durationMs}`)
      .join(',');
  }, [schedules]);

  const manualGramsEstimate = manualMode === 'grams' ? manualGrams : Math.round(manualMs / msPerGram);
  const manualInsufficient = !!selectedManualFeed && manualGramsEstimate > selectedManualFeed.availableGrams;
  const manualPending = lastManualFeed?.status === 'queued';

  // Handle manual trigger feed
  const handleTriggerFeed = async () => {
    if (!pondId) return;
    if (!selectedManualFeed || !selectedManualFeed.gramsPerUnit) {
      toast.error('Select a weight-based (kg/g) feed item from inventory');
      return;
    }
    if (manualGramsEstimate <= 0 || manualMs <= 0) {
      toast.error('Feed amount must be greater than zero');
      return;
    }
    if (manualInsufficient) {
      toast.error(`Not enough ${selectedManualFeed.name}: ${formatQty(selectedManualFeed.quantity)} ${selectedManualFeed.unit} left`);
      return;
    }
    setLoading(true);
    try {
      const pondRef = doc(db, 'ponds', pondId);

      // Queue the command. The server hands CMD:FEED + requested_ms to the gateway on GET /status
      // and deducts inventory at that moment, so stock only drops when the feeder actually runs.
      // calibration_ms is intentionally NOT overwritten here – it is the saved fallback duration.
      await setDoc(pondRef, {
        pending_command: 'CMD:FEED', // Exactly as expected by Steve's ESP32 handshake
        last_manual_feed: {
          request_id: crypto.randomUUID(),
          status: 'queued',
          requested_ms: manualMs,
          estimated_grams: manualGramsEstimate,
          feed_inventory_id: selectedManualFeed.id,
          feed_name: selectedManualFeed.name,
          timestamp: serverTimestamp()
        }
      }, { mergeFields: ['pending_command', 'last_manual_feed'] });

      toast.success(`Feed queued: ${manualGramsEstimate} g (${manualMs} ms). Inventory deducts when the feeder picks it up.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch manual feed');
    } finally {
      setLoading(false);
    }
  };

  // Add a new schedule slot
  const handleAddScheduleSlot = () => {
    if (schedules.length >= 10) {
      toast.error('Maximum 10 daily schedules allowed by hardware');
      return;
    }
    const nextHour = schedules.length > 0 ? (schedules[schedules.length - 1].hour + 4) % 24 : 8;
    const defaultGrams = 150;
    const newSlot: ScheduleSlot = {
      id: crypto.randomUUID(),
      hour: nextHour,
      grams: defaultGrams,
      durationMs: Math.round(defaultGrams * msPerGram),
      feedInventoryId: deductibleItems[0]?.id || '',
      feedName: deductibleItems[0]?.name || ''
    };
    setSchedules([...schedules, newSlot]);
  };

  // Update specific schedule slot
  const handleUpdateSlot = (id: string, field: 'hour' | 'grams' | 'feedInventoryId', value: any) => {
    setSchedules(prev => prev.map(slot => {
      if (slot.id !== id) return slot;
      const updated = { ...slot, [field]: value };
      if (field === 'grams') {
        updated.durationMs = Math.round(Number(value) * msPerGram);
      }
      if (field === 'feedInventoryId') {
        const item = inventoryItems.find(i => i.id === value);
        updated.feedName = item?.name || '';
      }
      return updated;
    }));
  };

  // Delete schedule slot
  const handleDeleteSlot = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Save full schedule and configuration to Firestore
  const handleSaveAll = async () => {
    if (!pondId) return;
    const invalidSlot = schedules.find(s => !deductibleItems.some(i => i.id === s.feedInventoryId));
    if (invalidSlot) {
      toast.error(`The ${String(invalidSlot.hour).padStart(2, '0')}:00 slot needs a valid kg/g feed item from inventory`);
      return;
    }
    setSavingSchedule(true);
    try {
      const pondRef = doc(db, 'ponds', pondId);
      await setDoc(pondRef, {
        schedule_str: compiledScheduleStr || null, // Flat string for Steve's GET downlink[cite: 10]
        calibration_ms: config.calibrationMs,       // Safety fallback motor duration[cite: 10, 11]
        feeder_config: config,
        schedules: schedules,
        updated_at: new Date()
      }, { merge: true });

      toast.success('Schedule & calibration committed to gateway downlink');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings');
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Status Ribbon */}
      <div className="bg-card border border-border p-5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Feeder Controller</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
              LoRa Node B
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Autonomous RTC scheduling & telemetry bridge</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Target Pond Picker */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Pond</span>
            <Input
              value={pondId}
              onChange={(e) => setPondId(e.target.value.toUpperCase())}
              className="w-28 font-mono text-center font-bold tracking-wide"
              placeholder="POND_01"
            />
          </div>

          {/* Status Badge */}
          <div className="border-l border-border pl-3 flex items-center gap-2">
            {deviceStatus === 'idle' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Standby
              </span>
            )}
            {deviceStatus === 'running' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                Motor Active
              </span>
            )}
            {deviceStatus === 'disconnected' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Offline
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Primary Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hopper Capacity Card */}
        <div className="bg-card border border-border p-6 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-teal-400" /> Hopper Level
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-foreground">{feedPercentage}%</span>
                <span className="text-sm text-teal-400 font-mono font-bold">~{remainingKg} kg</span>
              </div>
            </div>
            <div className="text-right font-mono text-xs text-muted-foreground">
              <span>Sensor: </span>
              <span className="text-foreground font-bold">{telemetry ? `${telemetry.distance_cm} cm` : '--'}</span>
            </div>
          </div>

          <div className="space-y-2 my-3">
            <Progress value={feedPercentage} className="h-2.5 bg-secondary" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Empty ({config.hopperEmptyDistanceCm}cm)</span>
              <span>Full ({config.hopperFullDistanceCm}cm)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
            <span>Capacity: {config.hopperCapacityKg} kg</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
              className="h-7 text-xs text-teal-400 hover:text-teal-300 gap-1 p-0"
            >
              <Settings2 className="h-3.5 w-3.5" /> Calibrate
            </Button>
          </div>
        </div>

        {/* Radio Link & RTC Clock Sync */}
        <div className="bg-card border border-border p-6 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
              <Radio className="h-4 w-4 text-amber-400" /> Uplink & Autonomous RTC
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${signalBadge.color}`}>
              {signalBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 my-2">
            <div className="bg-background/60 p-3 rounded-lg border border-border">
              <span className="text-[11px] text-muted-foreground block">Active Schedule</span>
              <span className="text-sm font-mono font-bold text-foreground mt-0.5 block truncate">
                {schedules.length} Timed Drops
              </span>
            </div>
            <div className="bg-background/60 p-3 rounded-lg border border-border">
              <span className="text-[11px] text-muted-foreground block">Calibration Rate</span>
              <span className="text-sm font-mono font-bold text-foreground mt-0.5 block">
                {config.dispenseRateGps} g/s ({msPerGram.toFixed(0)} ms/g)
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Hardware Polling: 5s</span>
              <span>Protocol: LoRa 433MHz</span>
            </div>
            {hardwareAction && (
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${hardwareAction.color}`}>
                    {hardwareAction.badge}
                  </span>
                  <span className="text-[11px] truncate">{hardwareAction.description}</span>
                </span>
                {telemetry?.hardware_timestamp && (
                  <span className="text-[10px] text-muted-foreground/80 hidden sm:inline pl-2">
                    t:{telemetry.hardware_timestamp}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calibration Panel (Collapsible) */}
      {showConfig && (
        <div className="bg-muted/40 border border-teal-500/30 p-5 rounded-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Settings2 className="h-4 w-4 text-teal-400" /> Feeder Physical Calibration
            </h3>
            <span className="text-xs text-muted-foreground">Stored in Firestore per pond</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Dispense Rate (g/s)</label>
              <Input
                type="number"
                step="0.5"
                value={config.dispenseRateGps}
                onChange={(e) => setConfig({ ...config, dispenseRateGps: Number(e.target.value) })}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Empty Distance (cm)</label>
              <Input
                type="number"
                value={config.hopperEmptyDistanceCm}
                onChange={(e) => setConfig({ ...config, hopperEmptyDistanceCm: Number(e.target.value) })}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Full Distance (cm)</label>
              <Input
                type="number"
                value={config.hopperFullDistanceCm}
                onChange={(e) => setConfig({ ...config, hopperFullDistanceCm: Number(e.target.value) })}
                className="font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Total Capacity (kg)</label>
              <Input
                type="number"
                value={config.hopperCapacityKg}
                onChange={(e) => setConfig({ ...config, hopperCapacityKg: Number(e.target.value) })}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Manual Feed Dispatch Card */}
      <div className="bg-card border border-border p-6 rounded-xl space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-teal-400" /> Instant Trigger Feed
            </h2>
            <p className="text-xs text-muted-foreground">Send an immediate CMD:FEED handshake to Node B</p>
          </div>
          <div className="flex bg-secondary p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setManualMode('grams')}
              className={`px-3 py-1 rounded font-medium transition ${manualMode === 'grams' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'}`}
            >
              By Grams
            </button>
            <button
              type="button"
              onClick={() => setManualMode('ms')}
              className={`px-3 py-1 rounded font-medium transition ${manualMode === 'ms' ? 'bg-background text-foreground shadow' : 'text-muted-foreground'}`}
            >
              Direct MS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {manualMode === 'grams' ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Target Feed Amount</span>
                <span className="font-mono text-teal-400 font-bold">{manualGrams} g</span>
              </label>
              <Input
                type="number"
                step={10}
                min={10}
                value={manualGrams}
                onChange={(e) => setManualGrams(Number(e.target.value))}
                className="font-mono"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex justify-between">
                <span>Motor Runtime Override</span>
                <span className="font-mono text-teal-400 font-bold">{manualMs} ms</span>
              </label>
              <Input
                type="number"
                step={100}
                min={500}
                value={manualMs}
                onChange={(e) => setManualMs(Number(e.target.value))}
                className="font-mono"
              />
            </div>
          )}

          {/* Select Feed from Inventory */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Inventory Source
            </label>
            <select
              value={selectedManualFeedId}
              onChange={(e) => setSelectedManualFeedId(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground font-medium focus:ring-1 focus:ring-teal-500"
            >
              {deductibleItems.length === 0 && <option value="">No kg/g feed in inventory</option>}
              {inventoryItems.map(item => (
                <option key={item.id} value={item.id} disabled={!item.gramsPerUnit || item.quantity <= 0}>
                  {item.name} ({formatQty(item.quantity)} {item.unit} left)
                  {!item.gramsPerUnit ? ' – non-weight unit' : item.quantity <= 0 ? ' – out of stock' : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleTriggerFeed}
            disabled={loading || deviceStatus === 'disconnected' || !selectedManualFeed || manualInsufficient}
            className="w-full bg-teal-500 hover:bg-teal-600 text-zinc-950 font-bold py-5 text-sm gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading || manualPending ? 'animate-spin' : ''}`} />
            {loading ? 'Queuing...' : `Trigger Feed (${manualMs} ms)`}
          </Button>
        </div>

        {manualInsufficient && selectedManualFeed && (
          <p className="text-xs text-rose-400">
            {manualGramsEstimate} g requested but only {formatQty(selectedManualFeed.quantity)} {selectedManualFeed.unit} of {selectedManualFeed.name} in stock.
          </p>
        )}

        {lastManualFeed?.status && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-t border-border pt-3">
            <span className="text-muted-foreground">
              Last manual feed: <span className="font-mono text-foreground">{lastManualFeed.estimated_grams ?? '--'} g</span>
              {lastManualFeed.feed_name ? ` of ${lastManualFeed.feed_name}` : ''}
            </span>
            {lastManualFeed.status === 'queued' && (
              <span className="text-amber-400">Queued in cloud – awaiting ESP32 poll</span>
            )}
            {lastManualFeed.status === 'dispatched' && (
              <span className="text-teal-400">Dispatched to Node B – 12s LoRa handshake in progress…</span>
            )}
            {lastManualFeed.status === 'feeding' && (
              <span className="text-amber-400 animate-pulse font-bold">Motor spinning on pond (Instant Start confirmed)</span>
            )}
            {(lastManualFeed.status === 'completed' || lastManualFeed.status === 'deducted') && (
              <span className="text-emerald-400">
                Cycle completed · deducted {formatQty(Math.abs(lastManualFeed.deduction?.change ?? 0))} {lastManualFeed.deduction?.unit}
                {lastManualFeed.final_distance_cm !== undefined ? ` (post-feed: ${lastManualFeed.final_distance_cm}cm)` : ''}
                {lastManualFeed.deduction?.insufficient_stock ? ' (stock depleted)' : ''}
              </span>
            )}
            {(lastManualFeed.status === 'completed_no_deduction' || lastManualFeed.status === 'dispatched_no_deduction') && (
              <span className="text-rose-400">
                Cycle finished · not deducted ({lastManualFeed.deduction?.reason || 'unknown'})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Feeding Schedule Builder (Steve's schedule_str) */}
      <div className="bg-card border border-border p-6 rounded-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-400" /> Autonomous RTC Schedule
            </h2>
            <p className="text-xs text-muted-foreground">
              Node A's RTC triggers motor automatically in 24-hr intervals (Max 10 per day). Inventory deducts when the feeder confirms each drop.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddScheduleSlot}
              disabled={schedules.length >= 10}
              className="text-xs gap-1 border-border"
            >
              <Plus className="h-3.5 w-3.5" /> Add Interval
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={savingSchedule}
              className="bg-teal-500 hover:bg-teal-600 text-zinc-950 font-bold text-xs gap-1"
            >
              <Save className="h-3.5 w-3.5" /> {savingSchedule ? 'Saving...' : 'Deploy Schedule'}
            </Button>
          </div>
        </div>

        {/* Downlink String Preview */}
        <div className="bg-background/80 border border-border rounded-lg p-3 flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">Downlink `schedule_str`:</span>
          <span className="text-teal-400 font-bold tracking-wider">
            {compiledScheduleStr ? `"${compiledScheduleStr}"` : 'null (No schedule)'}
          </span>
        </div>

        {/* Schedule Slots Table */}
        <div className="space-y-3">
          {schedules.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
              No autonomous schedules configured. Click "Add Interval" to create one.
            </div>
          ) : (
            schedules.map((slot, index) => (
              <div
                key={slot.id}
                className="grid grid-cols-12 gap-3 items-center bg-background/50 border border-border p-3 rounded-lg text-sm"
              >
                {/* 24-Hour Selector */}
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Time (24h)</label>
                  <select
                    value={slot.hour}
                    onChange={(e) => handleUpdateSlot(slot.id, 'hour', Number(e.target.value))}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono font-bold"
                  >
                    {Array.from({ length: 24 }).map((_, h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grams Input */}
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Weight (g)</label>
                  <Input
                    type="number"
                    step={10}
                    value={slot.grams}
                    onChange={(e) => handleUpdateSlot(slot.id, 'grams', Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {/* Auto-Calculated Duration */}
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Runtime</label>
                  <span className="inline-block py-1.5 text-xs font-mono font-bold text-teal-400">
                    {slot.durationMs} ms
                  </span>
                </div>

                {/* Feed Inventory Kind */}
                <div className="col-span-11 sm:col-span-5">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Feed Type</label>
                  <select
                    value={slot.feedInventoryId}
                    onChange={(e) => handleUpdateSlot(slot.id, 'feedInventoryId', e.target.value)}
                    className={`w-full bg-background border rounded px-2 py-1.5 text-xs truncate ${deductibleItems.some(i => i.id === slot.feedInventoryId) ? 'border-border' : 'border-rose-500/60 text-rose-400'}`}
                  >
                    {!inventoryItems.some(i => i.id === slot.feedInventoryId) && (
                      <option value={slot.feedInventoryId}>
                        {slot.feedInventoryId ? `${slot.feedName || 'Unknown feed'} (removed from inventory)` : 'Select feed…'}
                      </option>
                    )}
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id} disabled={!item.gramsPerUnit}>
                        {item.name} ({formatQty(item.quantity)} {item.unit})
                        {!item.gramsPerUnit ? ' – non-weight unit' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delete Slot Button */}
                <div className="col-span-1 flex justify-end pt-3 sm:pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomaticFeeding;