import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { InventoryItem } from '@/contexts/DataContext';

interface InventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  type: 'add' | 'consume';
}

export const InventoryModal = ({ open, onOpenChange, item, type }: InventoryModalProps) => {
  const { updateInventory } = useData();
  const [quantity, setQuantity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (type === 'consume' && qty > item.quantity) {
      toast.error('Cannot consume more than available quantity');
      return;
    }

    updateInventory(item.id, type === 'add' ? qty : -qty);
    toast.success(`Successfully ${type === 'add' ? 'added' : 'consumed'} ${qty} ${item.unit}`);
    setQuantity('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {type === 'add' ? 'Add Stock' : 'Consume Stock'} - {item.item_name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity ({item.unit})
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={type === 'consume' ? item.quantity : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
            />
            <p className="text-xs text-muted-foreground">
              Current stock: {item.quantity} {item.unit}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {type === 'add' ? 'Add Stock' : 'Consume Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
