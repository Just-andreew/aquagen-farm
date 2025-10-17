import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const Reports = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reportType, setReportType] = useState('');
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    if (!startDate || !endDate || !reportType) {
      return;
    }
    setGenerated(true);
  };

  const mockReportData = [
    { metric: 'Tasks Completed', value: '45' },
    { metric: 'Log Entries', value: '128' },
    { metric: 'Inventory Items Used', value: '32' },
    { metric: 'Emergency Reports', value: '3' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[#5EEAD4]">Reports</h1>

      <Card className="bg-[#013333] border-[#14B8A6]">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4]">Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[#5EEAD4]">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#013333] border-[#14B8A6]">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="text-[#5EEAD4]">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#013333] border-[#14B8A6]">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div>
            <Label className="text-[#5EEAD4]">Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-[#014D4D] border-[#14B8A6] text-[#5EEAD4]">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                <SelectItem value="monthly">Monthly Summary</SelectItem>
                <SelectItem value="tasks">Tasks Performance</SelectItem>
                <SelectItem value="inventory">Inventory Usage</SelectItem>
                <SelectItem value="emergency">Emergency Incidents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleGenerate} 
            className="w-full bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white"
            disabled={!startDate || !endDate || !reportType}
          >
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {generated && (
        <Card className="bg-[#013333] border-[#14B8A6]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-[#5EEAD4]">Report Preview</CardTitle>
            <Button className="bg-[#14B8A6] hover:bg-[#14B8A6]/80 text-white">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-[#5EEAD4] font-medium mb-2">
                  Report Period: {startDate && format(startDate, 'PPP')} - {endDate && format(endDate, 'PPP')}
                </p>
                <p className="text-[#5EEAD4]/70">Type: {reportType}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockReportData.map((item, idx) => (
                  <Card key={idx} className="bg-[#014D4D] border-[#14B8A6]">
                    <CardContent className="pt-6">
                      <p className="text-[#5EEAD4]/70 text-sm">{item.metric}</p>
                      <p className="text-2xl font-bold text-[#5EEAD4] mt-2">{item.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
