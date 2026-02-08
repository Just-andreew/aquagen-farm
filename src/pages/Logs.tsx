import { useState } from 'react';
import { useData, Log } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FileText, CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { AddLogModal } from '@/components/AddLogModal';
import { EditLogModal } from '@/components/EditLogModal'; // Import the new modal
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const Logs = () => {
  const { logs, deleteLog } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // State for Editing
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const filteredLogs = logs.filter(log => 
    log.animal_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.technician_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this log?")) {
      await deleteLog(id);
      toast.success("Log deleted successfully");
    }
  };

  const handleEdit = (log: Log) => {
    setSelectedLog(log);
    setIsEditModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">Activity Logs</h1>
          <p className="text-[#94A3B8]">Monitor daily farm operations and events</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-white gap-2"
        >
          <Plus className="h-4 w-4" /> New Log Entry
        </Button>
      </div>

      <div className="flex items-center space-x-2 bg-[#013333] p-2 rounded-lg border border-[#14B8A6]/20">
        <Search className="h-5 w-5 text-[#5EEAD4]" />
        <Input
          placeholder="Search by animal, event, or technician..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none text-[#5EEAD4] placeholder:text-[#5EEAD4]/50 focus-visible:ring-0"
        />
      </div>

      <div className="grid gap-4">
        {filteredLogs.map((log) => (
          <Card key={log.id} className="bg-[#013333] border-[#14B8A6]/20 hover:border-[#14B8A6] transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg text-[#5EEAD4] flex items-center gap-2">
                  {log.event_type}
                  <Badge variant="outline" className="text-[#14B8A6] border-[#14B8A6]">
                    {log.animal_type}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-[#94A3B8]">
                  Logged by {log.technician_name}
                </CardDescription>
              </div>
              
              {/* ACTION BUTTONS */}
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-[#5EEAD4] hover:text-[#14B8A6] hover:bg-[#14B8A6]/10"
                  onClick={() => handleEdit(log)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                  onClick={() => handleDelete(log.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="text-right text-xs text-[#94A3B8] flex flex-col items-end justify-center ml-2 border-l border-[#14B8A6]/20 pl-4">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(log.timestamp).toLocaleDateString()}
                  </div>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                 {/* Image Preview (Tiny Thumbnail) */}
                 {log.attached_file_url && (
                  <div className="shrink-0">
                    <img 
                      src={log.attached_file_url} 
                      alt="Log attachment" 
                      className="h-16 w-16 object-cover rounded-md border border-[#14B8A6]/30"
                    />
                  </div>
                )}
                <p className="text-gray-300 text-sm">
                  {log.data?.description || "No description provided."}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-[#94A3B8]">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No logs found matching your search</p>
          </div>
        )}
      </div>

      <AddLogModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
      
      {/* EDIT MODAL - Only renders if we have a selected log */}
      {selectedLog && (
        <EditLogModal 
          open={isEditModalOpen} 
          onOpenChange={setIsEditModalOpen} 
          log={selectedLog} 
        />
      )}
    </div>
  );
};

export default Logs;