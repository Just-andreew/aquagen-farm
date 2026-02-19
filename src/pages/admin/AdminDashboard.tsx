import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, Package, Activity, ArrowRight, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { tasks, inventory, logs } = useData();

  const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

  // --- DATA PROCESSING ---
  
  // 1. Task Scope (Admins see all, Techs see their own)
  const relevantTasks = isAdmin ? tasks : tasks.filter(t => t.assigned_to === user?.id);
  
  const tasksTodo = relevantTasks.filter(t => t.status === 'todo').length;
  const tasksInProgress = relevantTasks.filter(t => t.status === 'in_progress').length;
  const tasksDone = relevantTasks.filter(t => t.status === 'done').length;

  const chartData = [
    { name: 'To Do', value: tasksTodo, color: '#2DD4BF' }, // Cyan
    { name: 'In Progress', value: tasksInProgress, color: '#F59E0B' }, // Yellow
    { name: 'Done', value: tasksDone, color: '#10B981' }, // Emerald
  ];

  // 2. Inventory Alerts
  const lowInventory = inventory.filter(i => i.status === 'low' || i.status === 'out_of_stock');
  
  // 3. Activity Feed (Latest 5 logs)
  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  // Helper: Time Ago format
  const timeAgo = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000 / 60);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">AquaGen Overview</h1>
          <p className="text-[#94A3B8]">Welcome back, {user?.name} | <span className="uppercase text-xs font-bold tracking-widest">{user?.role.replace('_', ' ')}</span></p>
        </div>
        
        <div className="flex gap-2">
          <Link to="/tasks"><Button className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-[#013333] font-bold">My Tasks</Button></Link>
          <Link to="/logs"><Button variant="outline" className="border-[#14B8A6]/30 text-[#5EEAD4] hover:bg-[#14B8A6]/10">Log Activity</Button></Link>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Pending Tasks */}
        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Total Pending</CardTitle>
            <Clock className="w-4 h-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{tasksTodo + tasksInProgress}</div>
            <p className="text-xs text-[#94A3B8]">{isAdmin ? 'Farm-wide' : 'Assigned to you'}</p>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{tasksDone}</div>
            <p className="text-xs text-[#94A3B8]">Historical Total</p>
          </CardContent>
        </Card>

        {/* Inventory Warnings */}
        <Card className={`bg-[#013333] border-${lowInventory.length > 0 ? 'red-500/50' : '[#14B8A6]/20'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Low Stock Alerts</CardTitle>
            <AlertTriangle className={`w-4 h-4 ${lowInventory.length > 0 ? 'text-red-500 animate-pulse' : 'text-[#94A3B8]'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowInventory.length > 0 ? 'text-red-400' : 'text-white'}`}>
              {lowInventory.length}
            </div>
            <p className="text-xs text-[#94A3B8]">Items requiring restock</p>
          </CardContent>
        </Card>

        {/* Total Inventory Types */}
        <Card className="bg-[#013333] border-[#14B8A6]/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#5EEAD4]">Active Inventory</CardTitle>
            <Package className="w-4 h-4 text-[#14B8A6]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{inventory.length}</div>
            <p className="text-xs text-[#94A3B8]">Tracked SKUs</p>
          </CardContent>
        </Card>

      </div>

      {/* 3. Main Dashboard Body (Graphs & Lists) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph Section: Task Breakdown */}
        <Card className="col-span-1 bg-[#013333] border-[#14B8A6]/20">
          <CardHeader>
            <CardTitle className="text-[#5EEAD4] flex items-center gap-2">
              <ClipboardList className="w-5 h-5" /> Task Breakdown
            </CardTitle>
            <CardDescription className="text-[#94A3B8]">{isAdmin ? 'Farm-wide task progress' : 'Your personal workload'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
             {/* The Donut Chart */}
            <div className="h-48 w-full">
              {relevantTasks.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[#94A3B8] text-sm italic">No tasks assigned</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#013333', borderColor: '#14B8A6', color: '#5EEAD4', borderRadius: '8px' }}
                        itemStyle={{ color: '#white' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-2 text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#2DD4BF]" /> To Do</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#F59E0B]" /> In Progress</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10B981]" /> Done</span>
            </div>
          </CardContent>
        </Card>

        {/* Live Activity Feed */}
        <Card className="col-span-1 lg:col-span-2 bg-[#013333] border-[#14B8A6]/20 flex flex-col">
          <CardHeader className="pb-2 border-b border-[#14B8A6]/10">
            <div className="flex justify-between items-center">
              <CardTitle className="text-[#5EEAD4] flex items-center gap-2">
                <Activity className="w-5 h-5" /> Recent Field Activity
              </CardTitle>
              <Link to="/logs">
                  <span className="text-xs text-[#14B8A6] hover:text-white flex items-center gap-1 transition-colors">
                      View All <ArrowRight className="w-3 h-3" />
                  </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            <div className="space-y-4">
              {recentLogs.length === 0 ? (
                <div className="text-center py-8 text-[#94A3B8]">No activity logged yet.</div>
              ) : (
                recentLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4">
                    {/* Avatar Initials */}
                    <div className="h-8 w-8 rounded-full bg-[#14B8A6]/20 border border-[#14B8A6]/40 flex items-center justify-center text-xs font-bold text-[#5EEAD4] shrink-0">
                        {log.technician_name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Log Details */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            <span className="text-[#14B8A6]">{log.technician_name}</span> logged a <span className="font-bold">{log.event_type}</span> on <span className="text-slate-300">{log.animal_type}</span>
                        </p>
                        <p className="text-xs text-[#94A3B8] truncate">{log.data?.description || 'No description'}</p>
                    </div>

                    {/* Time */}
                    <div className="text-xs text-slate-500 whitespace-nowrap pt-1">
                        {timeAgo(log.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Critical Alerts (Inventory) */}
        {isAdmin && lowInventory.length > 0 && (
          <Card className="col-span-1 lg:col-span-3 bg-red-950/20 border-red-500/30 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-400 flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5" /> Critical Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lowInventory.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-red-950/40 rounded border border-red-500/20">
                        <div>
                            <p className="text-white font-medium text-sm">{item.item_name}</p>
                            <p className="text-xs text-red-300">
                                {item.quantity} {item.unit} remaining
                            </p>
                        </div>
                        <Badge variant="destructive" className="bg-red-600">
                            {item.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}