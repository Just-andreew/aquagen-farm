import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, AlertTriangle, Package } from 'lucide-react';
import { AddInventoryModal } from '@/components/AddInventoryModal';

const Inventory = () => {
  const { inventory } = useData(); // <--- Now listening to live Firebase data
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredInventory = inventory.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">Inventory Management</h1>
          <p className="text-[#94A3B8]">Track feed, equipment, and supplies</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-white gap-2"
        >
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-[#013333] p-2 rounded-lg border border-[#14B8A6]/20">
        <Search className="h-5 w-5 text-[#5EEAD4]" />
        <Input
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none text-[#5EEAD4] placeholder:text-[#5EEAD4]/50 focus-visible:ring-0"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventory.map((item) => (
          <Card key={item.id} className="bg-[#013333] border-[#14B8A6]/20 hover:border-[#14B8A6] transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold text-[#5EEAD4]">
                {item.item_name}
              </CardTitle>
              {item.status === 'low' && (
                <Badge variant="destructive" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Low Stock
                </Badge>
              )}
              {item.status === 'out_of_stock' && (
                <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Out of Stock
                </Badge>
              )}
              {item.status === 'in_stock' && (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  <Package className="h-3 w-3 mr-1" /> In Stock
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-2">
                {item.quantity} <span className="text-lg text-[#94A3B8] font-normal">{item.unit}</span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Last updated: {new Date(item.last_updated).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
        
        {filteredInventory.length === 0 && (
          <div className="col-span-full text-center py-12 text-[#94A3B8]">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No inventory items found</p>
          </div>
        )}
      </div>

      <AddInventoryModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
    </div>
  );
};

export default Inventory;