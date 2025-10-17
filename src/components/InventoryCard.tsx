import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InventoryModal } from '@/components/InventoryModal';
import { Button } from '@/components/ui/button';
import { Package, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import type { InventoryItem } from '@/contexts/DataContext';

interface InventoryCardProps {
  item: InventoryItem;
}

export const InventoryCard = ({ item }: InventoryCardProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'consume'>('add');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'text-green-500 bg-green-500/20';
      case 'low': return 'text-yellow-500 bg-yellow-500/20';
      case 'out_of_stock': return 'text-red-500 bg-red-500/20';
      default: return 'text-muted-foreground';
    }
  };

  const openModal = (type: 'add' | 'consume') => {
    setModalType(type);
    setModalOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <span className="text-base">{item.item_name}</span>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(item.status)}`}>
              {item.status.replace('_', ' ')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-semibold">{item.quantity} {item.unit}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last updated:</span>
              <span>{format(new Date(item.last_updated), 'MMM d, HH:mm')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openModal('add')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openModal('consume')}
              disabled={item.quantity === 0}
              className="gap-2"
            >
              <Minus className="w-4 h-4" />
              Consume
            </Button>
          </div>
        </CardContent>
      </Card>

      <InventoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={item}
        type={modalType}
      />
    </>
  );
};
