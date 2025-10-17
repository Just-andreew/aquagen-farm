import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

const Management = () => {
  const [activeTab, setActiveTab] = useState('users');

  const mockUsers = [
    { id: '1', name: 'Admin User', email: 'admin@aquagen.com', role: 'admin', status: 'active' },
    { id: '2', name: 'John Technician', email: 'tech@aquagen.com', role: 'farm_technician', status: 'active' },
  ];

  const mockFarms = [
    { id: '1', name: 'Pond A', location: 'North Section', capacity: '5000 fish', status: 'active' },
    { id: '2', name: 'Pond B', location: 'South Section', capacity: '3000 fish', status: 'active' },
    { id: '3', name: 'Pond C', location: 'East Section', capacity: '4000 fish', status: 'maintenance' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#5EEAD4]">Management</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-[#013333] border border-[#14B8A6]">
          <TabsTrigger value="users" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
            Users Management
          </TabsTrigger>
          <TabsTrigger value="farms" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
            Farms/Ponds
          </TabsTrigger>
          <TabsTrigger value="bulk" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-white">
            Bulk Task Assignment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="bg-[#013333] border-[#14B8A6]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-[#5EEAD4]">Users</CardTitle>
              <Button className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#14B8A6]">
                    <TableHead className="text-[#5EEAD4]">Name</TableHead>
                    <TableHead className="text-[#5EEAD4]">Email</TableHead>
                    <TableHead className="text-[#5EEAD4]">Role</TableHead>
                    <TableHead className="text-[#5EEAD4]">Status</TableHead>
                    <TableHead className="text-[#5EEAD4]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockUsers.map(user => (
                    <TableRow key={user.id} className="border-[#14B8A6]">
                      <TableCell className="text-[#5EEAD4]">{user.name}</TableCell>
                      <TableCell className="text-[#5EEAD4]">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={user.role === 'admin' ? 'bg-[#FF6B6B]' : 'bg-[#14B8A6]'}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-600">{user.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="farms">
          <Card className="bg-[#013333] border-[#14B8A6]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-[#5EEAD4]">Farms & Ponds</CardTitle>
              <Button className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Farm/Pond
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockFarms.map(farm => (
                  <Card key={farm.id} className="bg-[#014D4D] border-[#14B8A6]">
                    <CardHeader>
                      <CardTitle className="text-[#5EEAD4] text-lg">{farm.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-[#5EEAD4]/70 text-sm">Location: {farm.location}</p>
                      <p className="text-[#5EEAD4]/70 text-sm">Capacity: {farm.capacity}</p>
                      <Badge className={farm.status === 'active' ? 'bg-green-600' : 'bg-yellow-600'}>
                        {farm.status}
                      </Badge>
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1">Edit</Button>
                        <Button variant="outline" size="sm" className="flex-1 text-red-500 border-red-500">Delete</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="bg-[#013333] border-[#14B8A6]">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4]">Bulk Task Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[#5EEAD4]/70 text-center py-8">
                Bulk task assignment feature coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Management;
