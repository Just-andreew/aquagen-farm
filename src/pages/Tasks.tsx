import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { TaskStatus } from '@/contexts/DataContext';

const Tasks = () => {
  const { tasks, updateTask } = useData();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns: { status: TaskStatus; title: string }[] = [
    { status: 'todo', title: 'To Do' },
    { status: 'in_progress', title: 'In Progress' },
    { status: 'done', title: 'Done' },
  ];

  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    updateTask(taskId, { status: newStatus, updated_by: user?.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => (
          <div key={column.status} className="space-y-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <h2 className="font-semibold text-lg mb-4">{column.title}</h2>
              <div className="space-y-3">
                {getTasksByStatus(column.status).map((task) => (
                  <TaskCard key={task.id} task={task} onMove={moveTask} />
                ))}
                {getTasksByStatus(column.status).length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No tasks
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <TaskModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
};

export default Tasks;
