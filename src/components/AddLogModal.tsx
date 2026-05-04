import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertCircle, Camera, MapPin } from 'lucide-react';

// --- CONFIGURATION ---
// You can easily add, remove, or rename ponds here in the future
const AVAILABLE_PONDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

interface AddLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEventType?: string;
}

export const AddLogModal = ({ open, onOpenChange, defaultEventType }: AddLogModalProps) => {
  const { addLog, inventory, updateInventory } = useData();
  const { user } = useAuth();
  
  // Form State
  const [animalType, setAnimalType] = useState('Fish'); // Pre-selected to Fish
  const [eventType, setEventType] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPonds, setSelectedPonds] = useState<string[]>([]); // New Pond State
  
  // Feeding Specific State
  const [selectedFeedId, setSelectedFeedId] = useState('');
  const [feedAmount, setFeedAmount] = useState('');

  // Weight Specific State
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  
  // Image State
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      setEventType(defaultEventType || '');
    }
  }, [open, defaultEventType]);

  // Handle Pond Selection (Toggle logic)
  const togglePond = (pond: string) => {
    setSelectedPonds(prev => 
      prev.includes(pond) 
        ? prev.filter(p => p !== pond) // Remove if already selected
        : [...prev, pond]              // Add if not selected
    );
  };

  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scaleFactor = 800 / img.width;
          canvas.width = 800;
          canvas.height = img.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, 800, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!animalType || !eventType || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedPonds.length === 0) {
      toast.error('Please select at least one pond location.');
      return;
    }

    if (eventType === 'Feeding' && (!selectedFeedId || !feedAmount)) {
      toast.error('Please specify which feed was used and the amount.');
      return;
    }

    if (eventType === 'Weight Measurement' && !weightValue) {
      toast.error('Please enter the weight value.');
      return;
    }

    try {
      setIsProcessing(true);
      let finalFileUrl: string | null = null; 

      if (selectedFile && selectedFile.type.startsWith('image/')) {
        finalFileUrl = await processImage(selectedFile);
      }

      if (eventType === 'Feeding' && selectedFeedId) {
         const amount = parseFloat(feedAmount);
         if (!isNaN(amount) && amount > 0) {
            await updateInventory(selectedFeedId, -amount, `Fed to ${animalType} in ${selectedPonds.join(', ')}`);
         }
      }

      const logData: any = { 
        description,
        ponds: selectedPonds // Save the selected ponds array to the database
      };
      
      if (eventType === 'Feeding') {
        logData.feed_used = selectedFeedId;
        logData.feed_amount = feedAmount;
      } else if (eventType === 'Weight Measurement') {
        const rawNumber = parseFloat(weightValue);
        logData.weight_kg = weightUnit === 'g' ? (rawNumber / 1000).toString() : rawNumber.toString();
        logData.original_input = `${weightValue}${weightUnit}`;
      }

      await addLog({
        technician_id: user?.id || '',
        technician_name: user?.name || '',
        animal_type: animalType,
        event_type: eventType,
        data: logData,
        ...(finalFileUrl ? { attached_file_url: finalFileUrl } : {}),
      });

      toast.success('Log entry added successfully');

      // Reset Form
      setAnimalType('Fish');
      setEventType('');
      setDescription('');
      setSelectedPonds([]);
      setSelectedFeedId('');
      setFeedAmount('');
      setWeightValue('');
      setWeightUnit('kg');
      setSelectedFile(null);
      onOpenChange(false);

    } catch (error) {
      console.error("Error adding log:", error);
      toast.error('Failed to process request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#013333] border-[#14B8A6] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#5EEAD4]">Add Log Entry</DialogTitle>
          <DialogDescription className="text-slate-400">Record farm data below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
                <Label className="text-[#5EEAD4]">Animal Type *</Label>
                <Select value={animalType} onValueChange={setAnimalType}>
                <SelectTrigger className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                    <SelectItem value="Fish">Fish</SelectItem>
                    <SelectItem value="Shrimp">Shrimp</SelectItem>
                </SelectContent>
                </Select>
            </div>

            <div>
                <Label className="text-[#5EEAD4]">Event Type *</Label>
                <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]">
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                    <SelectItem value="Feeding">Feeding</SelectItem>
                    <SelectItem value="Weight Measurement">Weight Measurement</SelectItem>
                    <SelectItem value="Water Test">Water Test</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Health Check">Health Check</SelectItem>
                </SelectContent>
                </Select>
            </div>
          </div>

          {/* NEW SECTION: Location/Pond Selection */}
          <div className="space-y-2">
            <Label className="text-[#5EEAD4] flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Select Locations (Ponds) *
            </Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {AVAILABLE_PONDS.map(pond => (
                <Badge
                  key={pond}
                  onClick={() => togglePond(pond)}
                  className={`cursor-pointer px-4 py-2 text-sm transition-colors border ${
                    selectedPonds.includes(pond) 
                      ? 'bg-[#14B8A6] text-[#013333] hover:bg-[#14B8A6]/90 border-[#14B8A6]' 
                      : 'bg-[#014D4D] text-[#94A3B8] border-[#14B8A6]/30 hover:border-[#14B8A6] hover:text-[#5EEAD4]'
                  }`}
                >
                  {pond}
                </Badge>
              ))}
            </div>
          </div>

          {/* DYNAMIC SECTION: Feeding Details */}
          {eventType === 'Feeding' && (
             <div className="p-4 bg-[#014D4D]/50 rounded-lg border border-[#14B8A6]/30 space-y-3">
                <div className="flex items-center gap-2 text-[#5EEAD4] mb-2"><AlertCircle className="h-4 w-4" /><span className="font-semibold text-sm">Inventory Consumption</span></div>
                <div>
                    <Label className="text-[#5EEAD4]">Select Feed Item</Label>
                    <Select value={selectedFeedId} onValueChange={setSelectedFeedId}>
                        <SelectTrigger className="bg-[#013333] border-[#14B8A6] text-[#5EEAD4]"><SelectValue placeholder="Choose inventory item..." /></SelectTrigger>
                        <SelectContent className="bg-[#013333] border-[#14B8A6]">
                            {inventory.map((item) => (
                                <SelectItem key={item.id} value={item.id}>{item.item_name} ({item.quantity} {item.unit} available)</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="text-[#5EEAD4]">Total Amount Used</Label>
                    <div className="flex gap-2">
                        <Input type="number" step="0.01" placeholder="0.00" value={feedAmount} onChange={(e) => setFeedAmount(e.target.value)} className="bg-[#013333] border-[#14B8A6] text-[#5EEAD4]"/>
                        {selectedFeedId && <div className="flex items-center justify-center bg-[#14B8A6]/20 px-3 rounded text-[#5EEAD4] text-sm font-bold border border-[#14B8A6]">{inventory.find(i => i.id === selectedFeedId)?.unit || 'units'}</div>}
                    </div>
                </div>
             </div>
          )}

          {/* DYNAMIC SECTION: Weight Measurement */}
          {eventType === 'Weight Measurement' && (
            <div className="p-4 bg-[#014D4D]/50 rounded-lg border border-[#14B8A6]/30 space-y-3">
              <Label className="text-[#5EEAD4]">Average Sample Weight</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" placeholder="Enter amount..." value={weightValue} onChange={(e) => setWeightValue(e.target.value)} className="bg-[#013333] border-[#14B8A6] text-[#5EEAD4] flex-1"/>
                <div className="flex bg-[#013333] border border-[#14B8A6]/30 rounded-md p-1">
                  <button type="button" onClick={() => setWeightUnit('kg')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${weightUnit === 'kg' ? 'bg-[#14B8A6] text-[#013333]' : 'text-[#94A3B8]'}`}>KG</button>
                  <button type="button" onClick={() => setWeightUnit('g')} className={`px-3 py-1 rounded text-xs font-bold transition-all ${weightUnit === 'g' ? 'bg-[#14B8A6] text-[#013333]' : 'text-[#94A3B8]'}`}>G</button>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-[#5EEAD4]">Description / Notes *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]" placeholder="Enter details..." rows={2}/>
          </div>

          <div>
            <Label className="text-[#5EEAD4] flex items-center gap-2"><Camera className="w-4 h-4"/> Attach Photo (Optional)</Label>
            <Input type="file" accept="image/*" capture="environment" onChange={(e) => { if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]); }} className="mt-2 bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4] file:bg-[#14B8A6] file:text-[#013333] file:font-bold file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded hover:file:bg-[#14B8A6]/80 cursor-pointer"/>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing} className="text-[#94A3B8]">Cancel</Button>
            <Button type="submit" className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-[#013333] font-bold" disabled={isProcessing}>{isProcessing ? "Saving..." : "Save Log"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};