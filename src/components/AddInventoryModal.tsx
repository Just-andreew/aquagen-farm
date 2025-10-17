import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/contexts/DataContext';
import { toast } from '@/hooks/use-toast';

interface AddInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddInventoryModal = ({ open, onOpenChange }: AddInventoryModalProps) => {
  const { addInventoryItem } = useData();
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!itemName || !quantity || !unit) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty < 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    addInventoryItem({
      item_name: itemName,
      quantity: qty,
      unit: unit,
      status: qty === 0 ? 'out_of_stock' : qty < 20 ? 'low' : 'in_stock',
    });

    toast({
      title: 'Success',
      description: 'Inventory item added successfully',
    });

    setItemName('');
    setQuantity('');
    setUnit('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#013333] border-[#14B8A6]">
        <DialogHeader>
          <DialogTitle className="text-[#5EEAD4]">Add New Inventory Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="itemName" className="text-[#5EEAD4]">Item Name</Label>
            <Input
              id="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="e.g., Fish Feed Premium"
            />
          </div>

          <div>
            <Label htmlFor="quantity" className="text-[#5EEAD4]">Initial Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <Label htmlFor="unit" className="text-[#5EEAD4]">Unit</Label>
            <Input
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="e.g., kg, liters, boxes, packs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
