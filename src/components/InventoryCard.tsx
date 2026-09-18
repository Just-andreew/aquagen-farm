import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InventoryModal } from '@/components/InventoryModal';
import { EditInventoryModal } from '@/components/EditInventoryModal';
import { Button } from '@/components/ui/button';
import { Package, Plus, Minus, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import type { InventoryItem } from '@/contexts/DataContext';

interface InventoryCardProps {
  item: InventoryItem;
}

export const InventoryCard = ({ item }: InventoryCardProps) => {
  const { user } = useAuth();
  const { deleteInventoryItem } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'consume'>('add');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

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

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this inventory item?')) {
      try {
        await deleteInventoryItem(item.id);
      } catch (error) {
        console.error("Failed to delete item", error);
      }
    }
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
            {isAdmin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditModalOpen(true)}
                  className="gap-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <InventoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={item}
        type={modalType}
      />

      <EditInventoryModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        item={item}
      />
    </>
  );
};
