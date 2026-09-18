import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData, InventoryItem } from '@/contexts/DataContext';
import { toast } from '@/hooks/use-toast';

interface EditInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
}

export const EditInventoryModal = ({ open, onOpenChange, item }: EditInventoryModalProps) => {
  const { editInventoryItem } = useData();
  const [itemName, setItemName] = useState(item.item_name);
  const [quantity, setQuantity] = useState(item.quantity.toString());
  const [unit, setUnit] = useState(item.unit);

  useEffect(() => {
    setItemName(item.item_name);
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      await editInventoryItem(item.id, {
        item_name: itemName,
        quantity: qty,
        unit: unit,
        status: qty === 0 ? 'out_of_stock' : qty < 20 ? 'low' : 'in_stock',
      });

      toast({
        title: 'Success',
        description: 'Inventory item updated successfully',
      });

      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#013333] border-[#14B8A6]">
        <DialogHeader>
          <DialogTitle className="text-[#5EEAD4]">Edit Inventory Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="editItemName" className="text-[#5EEAD4]">Item Name</Label>
            <Input
              id="editItemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]"
              placeholder="e.g., Fish Feed Premium"
            />
          </div>

          <div>
            <Label htmlFor="editQuantity" className="text-[#5EEAD4]">Quantity</Label>
            <Input
              id="editQuantity"
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
            <Label htmlFor="editUnit" className="text-[#5EEAD4]">Unit</Label>
            <Input
              id="editUnit"
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
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
