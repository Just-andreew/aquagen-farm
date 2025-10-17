import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '@/contexts/DataContext';
import { useData } from '@/contexts/DataContext';
import { toast } from 'sonner';

interface TaskCardProps {
  task: Task;
  onMove: (taskId: string, newStatus: TaskStatus) => void;
}

export const TaskCard = ({ task, onMove }: TaskCardProps) => {
  const { consumeInventory } = useData();

  const canMoveLeft = task.status !== 'todo';
  const canMoveRight = task.status !== 'done';

  const handleMove = (direction: 'left' | 'right') => {
    const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'done'];
    const currentIndex = statusOrder.indexOf(task.status);
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    const newStatus = statusOrder[newIndex];

    if (newStatus === 'done' && task.consumed_inventory) {
      consumeInventory(task.consumed_inventory);
      toast.success('Task completed and inventory consumed');
    }

    onMove(task.id, newStatus);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return 'bg-muted';
      case 'in_progress': return 'bg-primary/20';
      case 'done': return 'bg-green-500/20';
    }
  };

  return (
    <Card className={`${getStatusColor(task.status)} border-border`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{task.title}</CardTitle>
        <CardDescription className="text-xs">{task.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned to:</span>
            <span>{task.assigned_to_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated:</span>
            <span>{format(new Date(task.updated_at), 'MMM d, HH:mm')}</span>
          </div>
        </div>
        
        <div className="flex justify-between gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleMove('left')}
            disabled={!canMoveLeft}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleMove('right')}
            disabled={!canMoveRight}
            className="flex-1"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
