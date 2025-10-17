import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AddLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddLogModal = ({ open, onOpenChange }: AddLogModalProps) => {
  const { addLog } = useData();
  const { user } = useAuth();
  const [animalType, setAnimalType] = useState('');
  const [eventType, setEventType] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!animalType || !eventType || !description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    addLog({
      technician_id: user?.id || '',
      technician_name: user?.name || '',
      animal_type: animalType,
      event_type: eventType,
      data: { description },
      attached_file_url: fileUrl || undefined,
    });

    toast({
      title: 'Success',
      description: 'Log entry added successfully',
    });

    setAnimalType('');
    setEventType('');
    setDescription('');
    setFileUrl('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#013333] border-[#14B8A6]">
        <DialogHeader>
          <DialogTitle className="text-[#5EEAD4]">Add Log Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="animalType" className="text-[#5EEAD4]">Animal Type *</Label>
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
            <Label htmlFor="eventType" className="text-[#5EEAD4]">Event Type *</Label>
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
            <Label htmlFor="description" className="text-[#5EEAD4]">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="Enter detailed description..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="fileUrl" className="text-[#5EEAD4]">Attached File URL (Optional)</Label>
            <Input
              id="fileUrl"
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="https://example.com/file.jpg"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
              Add Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
