import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryCard } from '@/components/InventoryCard';
import { AddInventoryModal } from '@/components/AddInventoryModal';
import { Button } from '@/components/ui/button';
import { Plus, History } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryStatus } from '@/contexts/DataContext';

const AdminInventory = () => {
  const { inventory, inventoryHistory } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('items');

  const getItemsByStatus = (status: InventoryStatus) => {
    return inventory.filter(item => item.status === status);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#5EEAD4]">Admin Inventory</h1>
        <Button onClick={() => setIsAddModalOpen(true)} className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Add New Item
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#013333] border border-[#14B8A6]">
          <TabsTrigger value="items" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
            Inventory Items
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Tabs defaultValue="in_stock" className="space-y-4">
            <TabsList className="bg-[#013333] border border-[#14B8A6]">
              <TabsTrigger value="in_stock" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
                In Stock ({getItemsByStatus('in_stock').length})
              </TabsTrigger>
              <TabsTrigger value="low" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
                Low Stock ({getItemsByStatus('low').length})
              </TabsTrigger>
              <TabsTrigger value="out_of_stock" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
                Out of Stock ({getItemsByStatus('out_of_stock').length})
              </TabsTrigger>
            </TabsList>

            {(['in_stock', 'low', 'out_of_stock'] as InventoryStatus[]).map(status => (
              <TabsContent key={status} value={status}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getItemsByStatus(status).map(item => (
                    <InventoryCard key={item.id} item={item} />
                  ))}
                  {getItemsByStatus(status).length === 0 && (
                    <p className="text-[#5EEAD4]/70 col-span-full text-center py-8">
                      No items in this category
                    </p>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>

        <TabsContent value="history">
          <Card className="bg-[#013333] border-[#14B8A6]">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4]">Inventory History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]">
                    <TableHead className="text-[#5EEAD4]">Timestamp</TableHead>
                    <TableHead className="text-[#5EEAD4]">Item</TableHead>
                    <TableHead className="text-[#5EEAD4]">Change</TableHead>
                    <TableHead className="text-[#5EEAD4]">Changed By</TableHead>
                    <TableHead className="text-[#5EEAD4]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryHistory.slice(0, 20).map(entry => (
                    <TableRow key={entry.id} className="border-[#14B8A6]">
                      <TableCell className="text-[#5EEAD4]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[#5EEAD4]">{entry.item_name}</TableCell>
                      <TableCell className={entry.change > 0 ? 'text-green-500' : 'text-red-500'}>
                        {entry.change > 0 ? '+' : ''}{entry.change}
                      </TableCell>
                      <TableCell className="text-[#5EEAD4]">{entry.changed_by_name}</TableCell>
                      <TableCell className="text-[#5EEAD4]">{entry.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {inventoryHistory.length === 0 && (
                <p className="text-center text-[#5EEAD4]/70 py-8">No history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddInventoryModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
    </div>
  );
};

export default AdminInventory;
