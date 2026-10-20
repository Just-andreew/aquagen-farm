import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
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
  Radio,
  RotateCcw,
  X
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
  already_deducted?: boolean;
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
  const [pondData, setPondData] = useState<any>(null);
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

  // Schedules state & dirty tracking: keeps user edits on screen so ESP32 heartbeats don't wipe them
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [isScheduleDirty, setIsScheduleDirty] = useState(false);
  const isScheduleDirtyRef = useRef(false);

  // Physical button notification dismiss state
  const [dismissedButtonTs, setDismissedButtonTs] = useState<number | null>(null);

  // Global Context & Auth for Inventory & Admin Logs
  const { user } = useAuth();
  const { inventory, updateInventory, addLog } = useData();

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

  // Reset dirty status when switching target ponds
  useEffect(() => {
    isScheduleDirtyRef.current = false;
    setIsScheduleDirty(false);
  }, [pondId]);

  // 2. Fetch pond configuration, active schedule string, and real-time state from 'ponds' collection
  useEffect(() => {
    if (!pondId) return;

    const pondDocRef = doc(db, 'ponds', pondId);
    const unsubPond = onSnapshot(pondDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPondData(data);
        if (data.feeder_config) {
          setConfig({ ...DEFAULT_CONFIG, ...data.feeder_config });
        }
        if (Array.isArray(data.schedules)) {
          // CRITICAL: Only overwrite local schedules from Firestore if the user has NOT made unsaved changes.
          // This prevents ESP32 5-second polling pings from wiping newly added intervals before the user deploys.
          if (!isScheduleDirtyRef.current) {
            setSchedules(data.schedules);
          }
        }
        setLastManualFeed(data.last_manual_feed || null);
      } else {
        setPondData(null);
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

    const unsubTelemetry = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          setTelemetry({
            ...docData,
            distance_cm: docData.distance_cm ?? docData.hopper_distance_cm,
            feed_triggered: docData.feed_triggered ?? docData.feed_event ?? false
          });
        }
      },
      (error) => {
        // Missing composite index in Firestore will fallback gracefully to pondData.last_telemetry
        console.warn('Telemetry collection subscription warning (using pond snapshot fallback):', error);
      }
    );

    return () => unsubTelemetry();
  }, [pondId]);

  // Active telemetry: combines historical/real-time collection telemetry with the pond snapshot fallback
  const activeTelemetry = useMemo(() => {
    if (telemetry) return telemetry;
    if (pondData?.last_telemetry) {
      return {
        ...pondData.last_telemetry,
        created_at: pondData.last_telemetry.updated_at || pondData.updated_at
      };
    }
    return null;
  }, [telemetry, pondData]);

  // Physical Button Press Detection & Timestamp
  const buttonFeedTime = useMemo(() => {
    if (!pondData?.last_button_feed?.timestamp) return null;
    const ts = pondData.last_button_feed.timestamp;
    return ts.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  }, [pondData?.last_button_feed]);

  const showButtonBanner = Boolean(
    buttonFeedTime && (!dismissedButtonTs || buttonFeedTime > dismissedButtonTs)
  );

  // Derived: Live Connection State based on 5-second polling heartbeat & telemetry trigger_source
  const deviceStatus = useMemo<'disconnected' | 'running' | 'idle'>(() => {
    // 1. Check live heartbeat timestamp from GET /status polling
    const pingTime = pondData?.last_ping?.toDate
      ? pondData.last_ping.toDate().getTime()
      : (pondData?.last_ping_ms || 0);

    // 2. Check telemetry timestamp
    const telemetryTime = activeTelemetry?.created_at?.toDate
      ? activeTelemetry.created_at.toDate().getTime()
      : (activeTelemetry?.updated_at?.toDate
        ? activeTelemetry.updated_at.toDate().getTime()
        : 0);

    const latestActiveTime = Math.max(pingTime, telemetryTime);

    if (!latestActiveTime) return 'disconnected';

    // 45-second heartbeat window (device polls every 5s; generous window for network variance)
    const isStale = Date.now() - latestActiveTime > 45 * 1000;
    if (isStale) return 'disconnected';

    if (pondData?.feeder_state === 'spinning' || pondData?.motor_active === true || activeTelemetry?.trigger_source === 'START') {
      return 'running';
    }

    return 'idle';
  }, [pondData, activeTelemetry]);

  // Derived: Hardware Action & Origin State (Protocol Table Logic & UI Mapping)
  const hardwareAction = useMemo(() => {
    if (!activeTelemetry) return null;
    const source = String(activeTelemetry.trigger_source || (activeTelemetry.feed_triggered ? 'AUTO' : 'NONE')).toUpperCase();
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
  }, [activeTelemetry]);

  // Derived: Feed Level Percentage and remaining weight (with robust fallback for historical fields)
  const { percentage: feedPercentage, remainingKg, sensorDistanceText } = useMemo(() => {
    const rawDist = activeTelemetry?.distance_cm ?? activeTelemetry?.hopper_distance_cm;
    if (rawDist === undefined || rawDist === null) {
      return { percentage: 0, remainingKg: 0, sensorDistanceText: '--' };
    }
    const dist = Number(rawDist);
    const rawPct = ((config.hopperEmptyDistanceCm - dist) /
      (config.hopperEmptyDistanceCm - config.hopperFullDistanceCm)) * 100;
    const clamped = Math.max(0, Math.min(100, Math.round(rawPct)));
    const kg = Number(((clamped / 100) * config.hopperCapacityKg).toFixed(1));
    return { percentage: clamped, remainingKg: kg, sensorDistanceText: `${dist.toFixed(1)} cm` };
  }, [activeTelemetry, config]);

  // Derived: RSSI signal level and color
  const rssiValue = activeTelemetry?.rssi ?? -100;
  const signalBadge = useMemo(() => {
    if (deviceStatus === 'disconnected') return { label: 'Offline', color: 'text-zinc-500 bg-zinc-500/10' };
    if (rssiValue >= -75) return { label: `${rssiValue} dBm (Excellent)`, color: 'text-emerald-400 bg-emerald-500/10' };
    if (rssiValue >= -90) return { label: `${rssiValue} dBm (Good)`, color: 'text-teal-400 bg-teal-500/10' };
    return { label: `${rssiValue} dBm (Weak)`, color: 'text-amber-400 bg-amber-500/10' };
  }, [rssiValue, deviceStatus]);

  // Build the Steve-compliant "Hour=DurationMs" string (e.g. "9=4000,13=6000,17=4000")
  const compiledScheduleStr = useMemo(() => {
    return schedules
      .filter(s => s.hour > 0 && s.grams > 0)
      .slice(0, 10)
      .sort((a, b) => a.hour - b.hour)
      .map(s => `${s.hour}=${s.durationMs}`)
      .join(',');
  }, [schedules]);

  const manualGramsEstimate = manualMode === 'grams' ? manualGrams : Math.round(manualMs / msPerGram);
  const manualInsufficient = !!selectedManualFeed && manualGramsEstimate > selectedManualFeed.availableGrams;
  const manualPending = lastManualFeed?.status === 'queued';

  // Handle manual trigger feed: Deducts inventory immediately and writes an entry to Admin Logs
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
      const requestId = crypto.randomUUID();
      const amountInUnit = Number((manualGramsEstimate / selectedManualFeed.gramsPerUnit).toFixed(3));

      // 1. Immediately deduct from inventory so that the web app reflects the change right away
      await updateInventory(
        selectedManualFeed.id,
        -amountInUnit,
        `Feeder [Web App Manual Drop] – ${pondId}: ${manualGramsEstimate}g`
      );

      // 2. Queue command for ESP32 with already_deducted: true to prevent double-deduction on uplink
      await setDoc(pondRef, {
        pending_command: 'CMD:FEED',
        last_manual_feed: {
          request_id: requestId,
          status: 'queued',
          requested_ms: manualMs,
          estimated_grams: manualGramsEstimate,
          feed_inventory_id: selectedManualFeed.id,
          feed_name: selectedManualFeed.name,
          timestamp: serverTimestamp(),
          already_deducted: true,
          deducted_change: -amountInUnit,
          deducted_unit: selectedManualFeed.unit
        }
      }, { mergeFields: ['pending_command', 'last_manual_feed'] });

      // 3. Record feed event so telemetry uplink knows this request was already deducted
      await setDoc(doc(db, 'feed_events', `${pondId}_manual_${requestId}`), {
        pond_id: pondId,
        trigger: 'manual',
        source: 'Web_App',
        grams: manualGramsEstimate,
        inventory_id: selectedManualFeed.id,
        item_name: selectedManualFeed.name,
        unit: selectedManualFeed.unit,
        change: -amountInUnit,
        deducted: true,
        created_at: serverTimestamp()
      }, { merge: true });

      // 4. Log action to Admin Logs
      await addLog({
        technician_id: user?.id || 'feeder_web',
        technician_name: user?.name ? `${user.name} (Feeder)` : `Automated Feeder (${pondId})`,
        animal_type: 'Fish',
        event_type: 'Feeding',
        data: {
          ponds: [pondId],
          metrics: { feed_amount: `${manualGramsEstimate}g`, average_weight_g: null, water_parameters: null },
          feed_used: selectedManualFeed.id,
          feed_name: selectedManualFeed.name,
          feed_amount: `${manualGramsEstimate}g`,
          runtime_ms: manualMs,
          trigger: 'manual',
          source: 'Web_App',
          notes: `Instant feed triggered from feeder controller for ${pondId}. Deducted ${amountInUnit} ${selectedManualFeed.unit} of ${selectedManualFeed.name}.`,
          original_text: `[Web Manual Feed]: Pond=${pondId}, Trigger=Web App Manual Drop, Amount=${manualGramsEstimate}g (${manualMs}ms)`,
          description: `Instant feed triggered: ${manualGramsEstimate}g (${manualMs}ms) to ${pondId}`
        }
      });

      toast.success(`Feed dispatched: ${manualGramsEstimate}g (${manualMs}ms). Deducted ${amountInUnit} ${selectedManualFeed.unit} from inventory.`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch manual feed');
    } finally {
      setLoading(false);
    }
  };

  // Add a new schedule slot - explicitly initialized to 0 for time and weight
  const handleAddScheduleSlot = () => {
    if (schedules.length >= 10) {
      toast.error('Maximum 10 daily schedules allowed by hardware');
      return;
    }
    const newSlot: ScheduleSlot = {
      id: crypto.randomUUID(),
      hour: 0, // Stays at 0 until user explicitly selects a time
      grams: 0, // Stays at 0 until user explicitly enters a weight
      durationMs: 0,
      feedInventoryId: deductibleItems[0]?.id || '',
      feedName: deductibleItems[0]?.name || ''
    };
    isScheduleDirtyRef.current = true;
    setIsScheduleDirty(true);
    setSchedules([...schedules, newSlot]);
  };

  // Update specific schedule slot
  const handleUpdateSlot = (id: string, field: 'hour' | 'grams' | 'feedInventoryId', value: any) => {
    isScheduleDirtyRef.current = true;
    setIsScheduleDirty(true);
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
    isScheduleDirtyRef.current = true;
    setIsScheduleDirty(true);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  // Discard unsaved schedule edits and revert back to what is stored in Firestore
  const handleDiscardChanges = () => {
    if (pondData && Array.isArray(pondData.schedules)) {
      setSchedules(pondData.schedules);
    } else {
      setSchedules([]);
    }
    isScheduleDirtyRef.current = false;
    setIsScheduleDirty(false);
    toast.info('Discarded unsaved schedule changes');
  };

  // Save full schedule and configuration to Firestore and log to Admin Logs
  const handleSaveAll = async () => {
    if (!pondId) return;

    if (schedules.length === 0) {
      toast.error('Please add at least one feeding interval before deploying');
      return;
    }

    // Validation: Require user to update time and weight from 0
    for (const slot of schedules) {
      if (slot.hour === 0 && slot.grams <= 0) {
        toast.error('Please update the time and weight from 0 before deploying schedule');
        return;
      }
      if (slot.hour === 0) {
        toast.error('Please select a scheduled time (cannot be left at 00:00)');
        return;
      }
      if (slot.grams <= 0) {
        toast.error(`Please enter a feed weight greater than 0g for the ${String(slot.hour).padStart(2, '0')}:00 slot`);
        return;
      }
      if (!deductibleItems.some(i => i.id === slot.feedInventoryId)) {
        toast.error(`The ${String(slot.hour).padStart(2, '0')}:00 slot needs a valid kg/g feed item from inventory`);
        return;
      }
    }

    // Check for duplicate hours
    const hours = schedules.map(s => s.hour);
    const duplicateHour = hours.find((h, idx) => hours.indexOf(h) !== idx);
    if (duplicateHour !== undefined) {
      toast.error(`Duplicate time slot found for ${String(duplicateHour).padStart(2, '0')}:00. Each daily interval must have a unique time.`);
      return;
    }

    setSavingSchedule(true);
    try {
      const pondRef = doc(db, 'ponds', pondId);
      await setDoc(pondRef, {
        schedule_str: compiledScheduleStr || null, // Flat string for Steve's GET downlink
        calibration_ms: config.calibrationMs,       // Safety fallback motor duration
        feeder_config: config,
        schedules: schedules,
        updated_at: new Date()
      }, { merge: true });

      // Log to Admin Logs
      await addLog({
        technician_id: user?.id || 'feeder_web',
        technician_name: user?.name ? `${user.name} (Feeder)` : `Admin (${pondId})`,
        animal_type: 'Fish',
        event_type: 'Feeding Schedule',
        data: {
          ponds: [pondId],
          schedule_str: compiledScheduleStr,
          total_slots: schedules.length,
          schedules: schedules.map(s => ({
            hour: s.hour,
            time: `${String(s.hour).padStart(2, '0')}:00`,
            grams: s.grams,
            durationMs: s.durationMs,
            feedName: s.feedName || 'Standard Feed'
          })),
          calibration_ms: config.calibrationMs,
          dispense_rate_gps: config.dispenseRateGps,
          source: 'Web_App',
          notes: `Autonomous feeding schedule deployed for ${pondId} with ${schedules.length} intervals (${compiledScheduleStr}).`,
          original_text: `[Schedule Deployed]: Pond=${pondId}, Slots=${schedules.length}, String="${compiledScheduleStr}"`,
          description: `Deployed ${schedules.length} feeding schedule intervals for ${pondId}`
        }
      });

      // Clear dirty flag so subsequent external updates are allowed
      isScheduleDirtyRef.current = false;
      setIsScheduleDirty(false);

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

      {/* Physical Feeder Button Notification Banner */}
      {showButtonBanner && pondData?.last_button_feed && (
        <div className="bg-purple-950/40 border border-purple-500/50 p-4 rounded-xl flex items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 border border-purple-500/30">
              BTN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-purple-200">
                  Physical Feeder Button Pressed
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  Hardware Feeder Action
                </span>
              </div>
              <p className="text-xs text-purple-300/80 mt-0.5">
                Feeder dispensed <span className="font-bold text-foreground font-mono">{pondData.last_button_feed.grams}g</span> of{' '}
                <span className="font-semibold text-purple-200">{pondData.last_button_feed.feed_name || 'Standard Feed'}</span> directly from pond hardware.
                {pondData.last_button_feed.distance_cm !== undefined && (
                  <span> · Sensor distance: <span className="font-mono font-bold text-foreground">{pondData.last_button_feed.distance_cm} cm</span></span>
                )}
                {buttonFeedTime && (
                  <span> · {new Date(buttonFeedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono px-2 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {pondData.last_button_feed.deducted ? '✓ Inventory Deducted' : 'Feed Logged'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissedButtonTs(buttonFeedTime)}
              className="h-7 w-7 p-0 text-purple-300 hover:text-purple-100 hover:bg-purple-500/20"
              title="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
              <span className="text-foreground font-bold">{sensorDistanceText}</span>
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-400" /> Autonomous RTC Schedule
              </h2>
              {isScheduleDirty && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Node A's RTC triggers motor automatically in 24-hr intervals (Max 10 per day). Inventory deducts when the feeder confirms each drop.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isScheduleDirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardChanges}
                disabled={savingSchedule}
                className="text-xs gap-1 text-muted-foreground hover:text-rose-400"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Discard
              </Button>
            )}
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
              className={`font-bold text-xs gap-1 transition ${isScheduleDirty ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-md shadow-amber-500/20' : 'bg-teal-500 hover:bg-teal-600 text-zinc-950'}`}
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
                    className={`w-full bg-background border rounded px-2 py-1.5 text-xs font-mono font-bold ${slot.hour === 0 ? 'border-amber-500/70 text-amber-400 bg-amber-500/5' : 'border-border'}`}
                  >
                    <option value={0}>00:00 (Set Time)</option>
                    {Array.from({ length: 23 }).map((_, i) => {
                      const h = i + 1;
                      return (
                        <option key={h} value={h}>
                          {h.toString().padStart(2, '0')}:00
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Grams Input */}
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Weight (g)</label>
                  <Input
                    type="number"
                    step={10}
                    min={0}
                    value={slot.grams === 0 ? '' : slot.grams}
                    placeholder="0"
                    onChange={(e) => handleUpdateSlot(slot.id, 'grams', Number(e.target.value) || 0)}
                    className={`h-8 text-xs font-mono ${slot.grams <= 0 ? 'border-amber-500/70 text-amber-400 bg-amber-500/5' : ''}`}
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