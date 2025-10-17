import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface EmergencyReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EmergencyReportModal = ({ open, onOpenChange }: EmergencyReportModalProps) => {
  const { addLog } = useData();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [animalType, setAnimalType] = useState('Fish');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    addLog({
      technician_id: user?.id || '2',
      technician_name: user?.name || 'Unknown',
      animal_type: animalType,
      event_type: 'Emergency',
      data: {
        title: title.trim(),
        description: description.trim(),
      },
    });

    toast.success('Emergency report filed successfully');
    setTitle('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            File Emergency Report
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief emergency title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="animalType">Animal Type</Label>
            <Select value={animalType} onValueChange={setAnimalType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fish">Fish</SelectItem>
                <SelectItem value="Shrimp">Shrimp</SelectItem>
                <SelectItem value="Tilapia">Tilapia</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the emergency"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-destructive hover:bg-destructive/90">
              File Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
