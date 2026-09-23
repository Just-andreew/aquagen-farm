import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Activity, Droplet } from 'lucide-react';
import { toast } from 'sonner';

const AutomaticFeeding = () => {
  const [pondId, setPondId] = useState('POND_01');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pondId) return;

    // Listen to the latest telemetry for this pond
    const q = query(
      collection(db, 'feeder_telemetry'),
      where('pond_id', '==', pondId),
      orderBy('created_at', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setTelemetry(snapshot.docs[0].data());
      } else {
        setTelemetry(null);
      }
    }, (error) => {
      console.error("Error fetching telemetry:", error);
    });

    return () => unsubscribe();
  }, [pondId]);

  const handleFeedNow = async () => {
    if (!pondId) return;
    setLoading(true);
    try {
      const pondRef = doc(db, 'ponds', pondId);
      // Using setDoc with merge: true in case the pond document doesn't exist yet
      await setDoc(pondRef, { pending_command: 'CMD:FEED' }, { merge: true });
      toast.success('Feed command queued successfully!');
    } catch (error) {
      console.error("Error sending feed command:", error);
      toast.error('Failed to send feed command.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">Automatic Feeding</h1>
          <p className="text-[#94A3B8]">Monitor and control automated feeders</p>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-lg max-w-xl">
        <div className="mb-6">
          <label className="block text-sm font-medium text-muted-foreground mb-2">Target Pond ID</label>
          <Input 
            value={pondId} 
            onChange={(e) => setPondId(e.target.value)}
            className="max-w-xs"
            placeholder="e.g. POND_01"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Feed Level Card */}
          <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center">
            <Droplet className="w-8 h-8 text-[#2DD4BF] mb-2" />
            <span className="text-sm text-muted-foreground">Raw Distance (CM)</span>
            <span className="text-3xl font-bold text-foreground mt-1">
              {telemetry ? `${telemetry.hopper_distance_cm} cm` : '--'}
            </span>
            <span className="text-xs text-muted-foreground mt-2">
              (Hopper Level Indicator)
            </span>
          </div>

          {/* Status Card */}
          <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center">
            <Activity className="w-8 h-8 text-[#FCD34D] mb-2" />
            <span className="text-sm text-muted-foreground">Last Feed Event</span>
            <span className="text-lg font-bold text-foreground mt-1 text-center">
              {telemetry?.feed_event ? 'Triggered Recently' : 'Waiting'}
            </span>
            <span className="text-xs text-muted-foreground mt-2 text-center">
              {telemetry?.created_at && typeof telemetry.created_at.toDate === 'function' 
                ? new Date(telemetry.created_at.toDate()).toLocaleString() 
                : 'No data available'}
            </span>
          </div>
        </div>

        <div className="flex justify-center border-t border-border pt-6">
          <Button 
            onClick={handleFeedNow} 
            disabled={loading}
            className="w-full sm:w-auto bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-[#013333] font-bold gap-2 text-lg py-6 px-8"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /> 
            {loading ? 'Queuing...' : 'Trigger Feed Now'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AutomaticFeeding;
