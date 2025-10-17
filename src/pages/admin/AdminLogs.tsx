import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LogFilters } from '@/components/LogFilters';
import { Download, CheckCircle, MessageSquare } from 'lucide-react';

const AdminLogs = () => {
  const { logs } = useData();
  const [filteredLogs, setFilteredLogs] = useState(logs);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Technician', 'Animal Type', 'Event Type', 'Data'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.technician_name,
        log.animal_type,
        log.event_type,
        JSON.stringify(log.data),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[#5EEAD4]">Admin Logs</h1>
        <Button onClick={handleExport} className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <LogFilters logs={logs} onFilter={setFilteredLogs} />

      <Card className="bg-[#013333] border-[#14B8A6]">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4]">Log Entries ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#14B8A6]">
                <TableHead className="text-[#5EEAD4]">Timestamp</TableHead>
                <TableHead className="text-[#5EEAD4]">Technician</TableHead>
                <TableHead className="text-[#5EEAD4]">Animal Type</TableHead>
                <TableHead className="text-[#5EEAD4]">Event Type</TableHead>
                <TableHead className="text-[#5EEAD4]">Data</TableHead>
                <TableHead className="text-[#5EEAD4]">Status</TableHead>
                <TableHead className="text-[#5EEAD4]">Admin Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map(log => (
                <TableRow key={log.id} className="border-[#14B8A6]">
                  <TableCell className="text-[#5EEAD4]">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[#5EEAD4]">{log.technician_name}</TableCell>
                  <TableCell className="text-[#5EEAD4]">{log.animal_type}</TableCell>
                  <TableCell>
                    <Badge className={log.event_type === 'Emergency' ? 'bg-[#FF6B6B]' : 'bg-[#14B8A6]'}>
                      {log.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#5EEAD4] text-sm">
                    {JSON.stringify(log.data).substring(0, 50)}...
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-yellow-600">Pending</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-green-500 border-green-500">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-[#14B8A6] border-[#14B8A6]">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredLogs.length === 0 && (
            <p className="text-center text-[#5EEAD4]/70 py-8">No logs found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogs;
