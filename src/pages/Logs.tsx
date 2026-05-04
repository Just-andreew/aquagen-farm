import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { AddLogModal } from '@/components/AddLogModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Droplets, Scale, Fish, Plus, Image as ImageIcon, History } from 'lucide-react';

type FilterType = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'last_month' | 'all';

export default function Logs() {
  const { logs } = useData();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('today');

  const handleOpenModal = (eventType: string) => {
    setSelectedAction(eventType);
    setIsAddModalOpen(true);
  };

  // --- DATE MATH HELPER ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  
  const dayOfWeek = now.getDay(); // 0 is Sunday
  const startOfWeek = startOfToday - (dayOfWeek * 86400000);
  const startOfLastWeek = startOfWeek - (7 * 86400000);
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const displayLogs = logs.filter(log => {
    const logTime = new Date(log.timestamp).getTime();
    switch (filter) {
      case 'today': return logTime >= startOfToday;
      case 'yesterday': return logTime >= startOfYesterday && logTime < startOfToday;
      case 'this_week': return logTime >= startOfWeek;
      case 'last_week': return logTime >= startOfLastWeek && logTime < startOfWeek;
      case 'last_month': return logTime >= startOfLastMonth && logTime < startOfMonth;
      case 'all': default: return true;
    }
  });

  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const getEventIcon = (type: string) => {
    switch(type) {
      case 'Feeding': return <Fish className="w-5 h-5 text-blue-400" />;
      case 'Water Test': return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'Weight Measurement': return <Scale className="w-5 h-5 text-purple-400" />;
      default: return <Activity className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* WIDGET 1: ACTION MATRIX (Compact 30% smaller) */}
      <Card className="bg-[#013333] border-[#14B8A6]/20 shadow-lg mb-6">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-lg font-bold text-[#14B8A6]">Record Activity</CardTitle>
          <p className="text-[#94A3B8] text-xs">Select an action to log farm data.</p>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* 2x2 Matrix Grid - Reduced padding and icon sizes */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button onClick={() => handleOpenModal('Feeding')} className="group flex flex-col items-center justify-center bg-[#014D4D] hover:bg-[#14B8A6]/20 border border-[#14B8A6]/30 rounded-lg p-3 sm:p-4 transition-all">
              <Fish className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400 mb-1.5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-xs font-bold text-slate-200 tracking-wide">FEED</span>
            </button>
            <button onClick={() => handleOpenModal('Weight Measurement')} className="group flex flex-col items-center justify-center bg-[#014D4D] hover:bg-[#14B8A6]/20 border border-[#14B8A6]/30 rounded-lg p-3 sm:p-4 transition-all">
              <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 mb-1.5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-xs font-bold text-slate-200 tracking-wide">WEIGHT</span>
            </button>
            <button onClick={() => handleOpenModal('Water Test')} className="group flex flex-col items-center justify-center bg-[#014D4D] hover:bg-[#14B8A6]/20 border border-[#14B8A6]/30 rounded-lg p-3 sm:p-4 transition-all">
              <Droplets className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 mb-1.5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-xs font-bold text-slate-200 tracking-wide">WATER</span>
            </button>
            <button onClick={() => handleOpenModal('')} className="group flex flex-col items-center justify-center bg-[#14B8A6]/10 hover:bg-[#14B8A6]/30 border border-[#14B8A6]/50 rounded-lg p-3 sm:p-4 transition-all">
              <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-[#5EEAD4] mb-1.5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-xs font-bold text-[#5EEAD4] tracking-wide">OTHER</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* WIDGET 2: HISTORY & TIMELINE (Bottom 2/3 focus) */}
      <Card className="bg-[#013333]/80 border-[#14B8A6]/10 shadow-lg min-h-[500px]">
        <CardHeader className="pb-2 border-b border-[#14B8A6]/10">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-[#5EEAD4]" />
            <CardTitle className="text-lg font-bold text-white">Activity History</CardTitle>
          </div>
          
          {/* Scrollable Date Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'last_week', label: 'Last Week' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All History' }
            ].map((f) => (
              <Badge 
                key={f.id}
                className={`cursor-pointer px-4 py-1.5 text-xs whitespace-nowrap transition-colors ${filter === f.id ? 'bg-[#14B8A6] text-[#013333] hover:bg-[#14B8A6]/90' : 'bg-[#014D4D] text-[#94A3B8] border border-[#14B8A6]/20 hover:text-white hover:border-[#14B8A6]/50'}`}
                onClick={() => setFilter(f.id as FilterType)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#14B8A6]/20 before:to-transparent">
            
            {displayLogs.length === 0 ? (
                <div className="text-center py-16 text-[#94A3B8] relative z-10 bg-[#014D4D]/50 rounded-xl border border-dashed border-[#14B8A6]/20 mx-2">
                    No records found for this period.
                </div>
            ) : (
                displayLogs.map((log) => (
                <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#013333] bg-[#014D4D] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10">
                        {getEventIcon(log.event_type)}
                    </div>
                    
                    <Card className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-black/40 border-[#14B8A6]/10 hover:border-[#14B8A6]/40 transition-colors">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-white text-sm">{log.event_type}</h4>
                                    <span className="text-xs text-[#14B8A6] font-medium">{log.technician_name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs font-bold text-slate-400">{formatTime(log.timestamp)}</span>
                                    {filter !== 'today' && <span className="block text-[10px] text-slate-500">{formatDate(log.timestamp)}</span>}
                                </div>
                            </div>
                            
                            <p className="text-sm text-slate-300 mb-3">{log.data?.description}</p>
                            
                            {/* Data Tags */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="text-[10px] bg-[#14B8A6]/5 border-[#14B8A6]/20 text-[#5EEAD4]">{log.animal_type}</Badge>
                                
                                {/* New Location Badge based on multi-select Ponds */}
                                {log.data?.ponds && log.data.ponds.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-900/20 border-emerald-500/30 text-emerald-300">
                                        Loc: {log.data.ponds.join(', ')}
                                    </Badge>
                                )}
                                
                                {log.data?.weight_kg && (
                                    <Badge variant="outline" className="text-[10px] bg-purple-900/20 border-purple-500/30 text-purple-300">
                                        Weight: {log.data.original_input || `${log.data.weight_kg} kg`}
                                    </Badge>
                                )}
                                {log.data?.feed_amount && (
                                    <Badge variant="outline" className="text-[10px] bg-blue-900/20 border-blue-500/30 text-blue-300">
                                        Fed: {log.data.feed_amount}
                                    </Badge>
                                )}
                            </div>

                            {/* Image Preview Thumbnail */}
                            {log.attached_file_url && (
                                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                                    <ImageIcon className="w-3 h-3" /> Photo Attached
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      <AddLogModal 
        open={isAddModalOpen} 
        onOpenChange={setIsAddModalOpen} 
        defaultEventType={selectedAction} 
      />
    </div>
  );
}