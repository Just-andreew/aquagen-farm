import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import type { Log } from '@/contexts/DataContext';

interface LogFiltersProps {
  logs: Log[];
  onFilter: (filtered: Log[]) => void;
}

export const LogFilters = ({ logs, onFilter }: LogFiltersProps) => {
  const [search, setSearch] = useState('');
  const [animalType, setAnimalType] = useState<string>('all');
  const [eventType, setEventType] = useState<string>('all');

  const animalTypes = ['all', ...Array.from(new Set(logs.map(log => log.animal_type)))];
  const eventTypes = ['all', ...Array.from(new Set(logs.map(log => log.event_type)))];

  useEffect(() => {
    let filtered = logs;

    if (search) {
      filtered = filtered.filter(log =>
        log.technician_name.toLowerCase().includes(search.toLowerCase()) ||
        log.animal_type.toLowerCase().includes(search.toLowerCase()) ||
        log.event_type.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (animalType !== 'all') {
      filtered = filtered.filter(log => log.animal_type === animalType);
    }

    if (eventType !== 'all') {
      filtered = filtered.filter(log => log.event_type === eventType);
    }

    onFilter(filtered);
  }, [search, animalType, eventType, logs, onFilter]);

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={animalType} onValueChange={setAnimalType}>
          <SelectTrigger>
            <SelectValue placeholder="Animal Type" />
          </SelectTrigger>
          <SelectContent>
            {animalTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type === 'all' ? 'All Animals' : type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger>
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type === 'all' ? 'All Events' : type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
};
