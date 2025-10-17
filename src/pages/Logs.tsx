import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { LogFilters } from '@/components/LogFilters';
import { EmergencyReportModal } from '@/components/EmergencyReportModal';
import { AddLogModal } from '@/components/AddLogModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Download, Plus } from 'lucide-react';
import { format } from 'date-fns';

const Logs = () => {
  const { logs } = useData();
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(false);
  const [filteredLogs, setFilteredLogs] = useState(logs);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Technician', 'Animal Type', 'Event Type', 'Data'],
      ...filteredLogs.map(log => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.technician_name,
        log.animal_type,
        log.event_type,
        JSON.stringify(log.data),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Logs</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddLogModalOpen(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Log
          </Button>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button 
            onClick={() => setIsEmergencyModalOpen(true)} 
            className="gap-2 bg-destructive hover:bg-destructive/90"
          >
            <AlertCircle className="w-4 h-4" />
            File Emergency
          </Button>
        </div>
      </div>

      <LogFilters logs={logs} onFilter={setFilteredLogs} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Technician</TableHead>
              <TableHead>Animal Type</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}</TableCell>
                  <TableCell>{log.technician_name}</TableCell>
                  <TableCell>{log.animal_type}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                      {log.event_type}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {typeof log.data === 'object' ? JSON.stringify(log.data) : log.data}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AddLogModal open={isAddLogModalOpen} onOpenChange={setIsAddLogModalOpen} />
      <EmergencyReportModal open={isEmergencyModalOpen} onOpenChange={setIsEmergencyModalOpen} />
    </div>
  );
};

export default Logs;
