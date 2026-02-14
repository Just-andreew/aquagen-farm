import { useState } from 'react';
import { useData, TaskStatus } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { TaskCard } from '@/components/TaskCard';
import { TaskModal } from '@/components/TaskModal';
import { Button } from '@/components/ui/button';
import { Plus, Filter, CheckSquare } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';

const Tasks = () => {
  const { tasks } = useData();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);

  const filteredTasks = tasks.filter(task => {
    if (showOnlyMine && user && task.assigned_to !== user.id) return false;
    if (hideCompleted && task.status === 'done') {
      const taskDate = new Date(task.updated_at || task.created_at);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      if (taskDate < oneDayAgo) return false;
    }
    return true;
  });

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(task => task.status === status);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">Task Board</h1>
          <p className="text-[#94A3B8]">Manage farm operations and assignments</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Toggle 
            pressed={showOnlyMine} 
            onPressedChange={setShowOnlyMine}
            className="gap-2 border border-[#14B8A6]/30 text-[#5EEAD4] data-[state=on]:bg-[#14B8A6] data-[state=on]:text-[#013333] hover:bg-[#14B8A6]/10"
          >
            <Filter className="h-4 w-4" />
            My Tasks
          </Toggle>

          <Toggle 
            pressed={!hideCompleted} 
            onPressedChange={(val) => setHideCompleted(!val)}
            className="gap-2 border border-[#14B8A6]/30 text-[#5EEAD4] hover:bg-[#14B8A6]/10"
          >
            <CheckSquare className="h-4 w-4" />
            Show History
          </Toggle>

          <Button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-[#14B8A6] hover:bg-[#14B8A6]/90 text-[#013333] font-bold gap-2"
          >
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* THE FIX: 
            1. "To Do" uses 'text-white' and 'border-teal' instead of slate.
            2. "In Progress" uses a glowing yellow.
            3. "Done" uses a glowing emerald.
        */}
        <TaskColumn 
          title="To Do" 
          tasks={getTasksByStatus('todo')} 
          headerColor="text-white border-l-4 border-[#2DD4BF] bg-gradient-to-r from-[#2DD4BF]/10 to-transparent" 
        />
        
        <TaskColumn 
          title="In Progress" 
          tasks={getTasksByStatus('in_progress')} 
          headerColor="text-[#FCD34D] border-l-4 border-[#F59E0B] bg-gradient-to-r from-[#F59E0B]/10 to-transparent" 
        />
        
        <TaskColumn 
          title="Done (Last 24h)" 
          tasks={getTasksByStatus('done')} 
          headerColor="text-[#34D399] border-l-4 border-[#10B981] bg-gradient-to-r from-[#10B981]/10 to-transparent" 
        />
      </div>

      <TaskModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </div>
  );
};

// THE COLUMN FIX:
// Changed background to 'bg-black/20' for a "recessed slot" look.
// Changed border to 'border-[#14B8A6]/10' for subtle integration.
const TaskColumn = ({ title, tasks, headerColor }: { title: string, tasks: any[], headerColor: string }) => (
  <div className="rounded-lg p-0 flex flex-col h-full bg-black/20 border border-[#14B8A6]/10 backdrop-blur-sm">
    <div className={`flex items-center justify-between mb-4 p-4 rounded-t-lg ${headerColor}`}>
      <h2 className="font-bold tracking-wide text-sm uppercase opacity-90">{title}</h2>
      <span className="bg-black/40 text-white/80 px-2 py-0.5 rounded-full text-xs font-bold border border-white/10 shadow-sm">
        {tasks.length}
      </span>
    </div>
    <div className="space-y-3 overflow-y-auto flex-1 px-4 pb-4 custom-scrollbar">
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center text-[#94A3B8]/50 text-sm border-2 border-dashed border-[#14B8A6]/10 rounded-lg m-2">
          <span className="text-xs uppercase tracking-widest">Empty</span>
        </div>
      ) : (
        tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))
      )}
    </div>
  </div>
);

export default Tasks;