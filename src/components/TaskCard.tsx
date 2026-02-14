import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, User, Pencil, Clock } from "lucide-react";
import { Task, useData } from "@/contexts/DataContext";
import { toast } from "sonner";
import { EditTaskModal } from "./EditTaskModal";

interface TaskCardProps {
  task: Task;
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const { updateTask, deleteTask } = useData();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const statusOrder: Task['status'][] = ['todo', 'in_progress', 'done'];
  const currentIndex = statusOrder.indexOf(task.status);
  
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < statusOrder.length - 1;

  // Kenya Date Format
  const formatKenyanDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const isDueToday = task.due_date && new Date(task.due_date).toDateString() === new Date().toDateString();

  const handleMove = async (direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    const newStatus = statusOrder[newIndex];
    await updateTask(task.id, { status: newStatus });
    toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this task?")) {
      await deleteTask(task.id);
      toast.success("Task deleted");
    }
  };

  // COLOR LOGIC: Dark Teal Backgrounds with colored borders
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'done': return 'border-l-green-500/50 bg-[#013333]/80';
      case 'in_progress': return 'border-l-yellow-500/50 bg-[#013333]/80';
      default: return 'border-l-slate-500/50 bg-[#013333]/80';
    }
  };

  return (
    <>
      <Card className={`hover:shadow-lg transition-all duration-300 border border-[#14B8A6]/30 border-l-[6px] ${getStatusStyle(task.status)} group`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-3">
          <div className="space-y-1 w-full mr-2">
            <CardTitle className="text-base font-bold text-[#5EEAD4] leading-tight">
              {task.title}
            </CardTitle>
            <CardDescription className="text-xs text-[#94A3B8] line-clamp-2 font-medium">
              {task.description}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-1 -mr-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-[#14B8A6] hover:text-[#5EEAD4] hover:bg-[#14B8A6]/20"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-900/20"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0 p-3">
          <div className="flex flex-col gap-2 text-xs text-[#94A3B8] font-medium">
            <div className="flex justify-between items-center bg-[#014D4D]/50 p-1.5 rounded border border-[#14B8A6]/20">
                <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#14B8A6]" />
                    <span>{task.assigned_to_name || 'Unassigned'}</span>
                </div>
                
                {task.due_date && (
                    <div className={`flex items-center gap-1.5 font-bold ${
                      isOverdue ? 'text-red-400' : isDueToday ? 'text-orange-400' : 'text-[#14B8A6]'
                    }`}>
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatKenyanDate(task.due_date)}</span>
                    </div>
                )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMove('left')}
              disabled={!canMoveLeft}
              className="flex-1 h-8 bg-transparent border-[#14B8A6]/30 text-[#5EEAD4] hover:bg-[#14B8A6]/10 hover:text-[#5EEAD4] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMove('right')}
              disabled={!canMoveRight}
              className="flex-1 h-8 bg-transparent border-[#14B8A6]/30 text-[#5EEAD4] hover:bg-[#14B8A6]/10 hover:text-[#5EEAD4] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditTaskModal 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        task={task} 
      />
    </>
  );
};