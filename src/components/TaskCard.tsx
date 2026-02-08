import { useState } from "react"; // Added useState
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2, CalendarDays, User, Pencil } from "lucide-react"; // Added Pencil
import { Task, useData } from "@/contexts/DataContext";
import { toast } from "sonner";
import { EditTaskModal } from "./EditTaskModal"; // Import the new modal

interface TaskCardProps {
  task: Task;
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const { updateTask, deleteTask } = useData();
  const [isEditOpen, setIsEditOpen] = useState(false); // State for the edit modal

  const statusOrder: Task['status'][] = ['todo', 'in_progress', 'done'];
  const currentIndex = statusOrder.indexOf(task.status);
  
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < statusOrder.length - 1;

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'border-l-green-500 bg-green-50/50';
      case 'in_progress': return 'border-l-yellow-500 bg-yellow-50/50';
      default: return 'border-l-slate-500 bg-white';
    }
  };

  return (
    <>
      <Card className={`hover:shadow-md transition-all duration-300 border-l-4 ${getStatusColor(task.status)}`}>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1 w-full mr-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              {task.title}
            </CardTitle>
            <CardDescription className="text-xs line-clamp-2">
              {task.description}
            </CardDescription>
          </div>
          
          {/* ACTION BUTTONS GROUP */}
          <div className="flex items-center gap-1 -mr-2 -mt-1">
            {/* EDIT BUTTON */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => setIsEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* DELETE BUTTON */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-2">
          {/* Details */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">{task.assigned_to_name || 'Unassigned'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{new Date(task.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Workflow Arrows */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMove('left')}
              disabled={!canMoveLeft}
              className="flex-1 h-8 bg-white hover:bg-slate-100 border-slate-200"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMove('right')}
              disabled={!canMoveRight}
              className="flex-1 h-8 bg-white hover:bg-slate-100 border-slate-200"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RENDER MODAL HERE */}
      <EditTaskModal 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen} 
        task={task} 
      />
    </>
  );
};