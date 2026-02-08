import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData, Log } from '@/contexts/DataContext';
import { toast } from '@/hooks/use-toast';

interface EditLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: Log;
}

export const EditLogModal = ({ open, onOpenChange, log }: EditLogModalProps) => {
  const { updateLog } = useData();
  const [animalType, setAnimalType] = useState(log.animal_type);
  const [eventType, setEventType] = useState(log.event_type);
  const [description, setDescription] = useState(log.data?.description || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper: Compress image to Base64 (Same as AddLogModal)
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
          const newWidth = 800;
          const newHeight = img.height * scaleFactor;
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, newWidth, newHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!animalType || !eventType || !description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsProcessing(true);
      let finalFileUrl = log.attached_file_url; // Default to existing image

      // Only process image if user picked a NEW one
      if (selectedFile) {
        if (selectedFile.type.startsWith('image/')) {
            finalFileUrl = await processImage(selectedFile);
        } else {
            toast({
                title: 'Warning',
                description: 'Only image files are supported.',
                variant: 'destructive',
            });
            setIsProcessing(false);
            return;
        }
      }

      await updateLog(log.id, {
        animal_type: animalType,
        event_type: eventType,
        data: { description },
        attached_file_url: finalFileUrl,
      });

      toast({
        title: 'Success',
        description: 'Log entry updated successfully',
      });

      onOpenChange(false);

    } catch (error) {
      console.error("Error updating log:", error);
      toast({
        title: 'Error',
        description: 'Failed to update log.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#013333] border-[#14B8A6]">
        <DialogHeader>
          <DialogTitle className="text-[#5EEAD4]">Edit Log Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-animalType" className="text-[#5EEAD4]">Animal Type *</Label>
            <Select value={animalType} onValueChange={setAnimalType}>
              <SelectTrigger className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]">
                <SelectValue placeholder="Select animal type" />
              </SelectTrigger>
              <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                <SelectItem value="Fish">Fish</SelectItem>
                <SelectItem value="Shrimp">Shrimp</SelectItem>
                <SelectItem value="Tilapia">Tilapia</SelectItem>
                <SelectItem value="Crab">Crab</SelectItem>
                <SelectItem value="Catfish">Catfish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-eventType" className="text-[#5EEAD4]">Event Type *</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                <SelectItem value="Feeding">Feeding</SelectItem>
                <SelectItem value="Water Test">Water Test</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Health Check">Health Check</SelectItem>
                <SelectItem value="Harvesting">Harvesting</SelectItem>
                <SelectItem value="Cleaning">Cleaning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-description" className="text-[#5EEAD4]">Description *</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="edit-fileInput" className="text-[#5EEAD4]">Change Photo (Optional)</Label>
            <Input
              id="edit-fileInput"
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
              }}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4] file:bg-[#14B8A6] file:text-white file:border-0 file:rounded-md file:mr-4"
            />
            {log.attached_file_url && !selectedFile && (
              <p className="text-xs text-green-400 mt-1">Current image will be kept if you don't upload a new one.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white" disabled={isProcessing}>
              {isProcessing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};