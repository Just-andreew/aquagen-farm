import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { InventoryCard } from '@/components/InventoryCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InventoryStatus } from '@/contexts/DataContext';

const Inventory = () => {
  const { inventory } = useData();

  const getItemsByStatus = (status: InventoryStatus) => 
    inventory.filter(item => item.status === status);

  const statusConfig = [
    { status: 'in_stock' as InventoryStatus, label: 'In Stock', color: 'text-green-500' },
    { status: 'low' as InventoryStatus, label: 'Low Stock', color: 'text-yellow-500' },
    { status: 'out_of_stock' as InventoryStatus, label: 'Out of Stock', color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inventory</h1>

      <Tabs defaultValue="in_stock" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {statusConfig.map((config) => (
            <TabsTrigger key={config.status} value={config.status}>
              <span className={config.color}>{config.label}</span>
              <span className="ml-2 text-muted-foreground">
                ({getItemsByStatus(config.status).length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {statusConfig.map((config) => (
          <TabsContent key={config.status} value={config.status} className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getItemsByStatus(config.status).map((item) => (
                <InventoryCard key={item.id} item={item} />
              ))}
              {getItemsByStatus(config.status).length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  No items in this category
                </p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Inventory;
