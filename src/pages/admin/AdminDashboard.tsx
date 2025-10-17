import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ClipboardList, Package, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { tasks, logs, inventory } = useData();

  const activeTechnicians = 2; // Mock count
  const openTasks = tasks.filter(t => t.status !== 'done').length;
  const lowInventory = inventory.filter(i => i.status === 'low' || i.status === 'out_of_stock').length;
  const recentEmergencies = logs.filter(l => l.event_type === 'Emergency' && 
    new Date(l.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  const tasksCompletedData = [
    { day: 'Mon', completed: 4 },
    { day: 'Tue', completed: 6 },
    { day: 'Wed', completed: 5 },
    { day: 'Thu', completed: 8 },
    { day: 'Fri', completed: 7 },
    { day: 'Sat', completed: 3 },
    { day: 'Sun', completed: 2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#5EEAD4]">AquaGen Analytics</h1>
        <p className="text-[#5EEAD4]/70">Welcome back, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#013333] border-[#14B8A6]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Active Technicians</CardTitle>
            <Users className="h-4 w-4 text-[#14B8A6]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#5EEAD4]">{activeTechnicians}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Open Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-[#14B8A6]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#5EEAD4]">{openTasks}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Low Inventory</CardTitle>
            <Package className="h-4 w-4 text-[#FF6B6B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF6B6B]">{lowInventory}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#013333] border-[#14B8A6]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Recent Emergencies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-[#FF6B6B]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FF6B6B]">{recentEmergencies}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#013333] border-[#14B8A6]">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4]">Tasks Completed (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tasksCompletedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#014D4D" />
              <XAxis dataKey="day" stroke="#5EEAD4" />
              <YAxis stroke="#5EEAD4" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#013333', border: '1px solid #14B8A6' }}
                labelStyle={{ color: '#5EEAD4' }}
              />
              <Bar dataKey="completed" fill="#14B8A6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-[#013333] border-[#14B8A6]">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4]">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-[#014D4D] rounded">
                <div>
                  <p className="text-[#5EEAD4] font-medium">{log.event_type} - {log.animal_type}</p>
                  <p className="text-[#5EEAD4]/70 text-sm">{log.technician_name}</p>
                </div>
                <span className="text-[#5EEAD4]/70 text-sm">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-[#5EEAD4]/70 text-center py-4">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
