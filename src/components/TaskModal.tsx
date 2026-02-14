import { useState, useEffect } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // NEW PROPS: Allow pre-filling the form
  defaultAssignee?: string; 
  defaultValues?: {
    title: string;
    description: string;
  };
}

interface UserOption {
  id: string;
  name: string;
}

export const TaskModal = ({ open, onOpenChange, defaultAssignee, defaultValues }: TaskModalProps) => {
  const { addTask } = useData();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const canAssignOthers = user?.role === 'admin' || user?.role === 'supervisor';
  const todayStr = new Date().toISOString().split('T')[0];

  // Reset or Pre-fill form when modal opens
  useEffect(() => {
    if (open) {
      if (defaultValues) {
        setTitle(defaultValues.title);
        setDescription(defaultValues.description);
      } else {
        setTitle('');
        setDescription('');
      }
      
      if (defaultAssignee) {
        setAssignedTo(defaultAssignee);
      } else if (!canAssignOthers && user) {
        setAssignedTo(user.id);
      } else {
        setAssignedTo('');
      }
      
      setDueDate('');
    }
  }, [open, defaultAssignee, defaultValues, canAssignOthers, user]);

  useEffect(() => {
    if (!open) return;

    if (!canAssignOthers && user) {
      setAvailableUsers([{ id: user.id, name: user.name }]);
      return;
    }

    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList: UserOption[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name) usersList.push({ id: doc.id, name: data.name });
        });
        setAvailableUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [open, canAssignOthers, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }
    if (!assignedTo) {
      toast.error('Please assign the task');
      return;
    }
    if (!dueDate) {
      toast.error('Please set a due date');
      return;
    }

    const assignedUserName = availableUsers.find(u => u.id === assignedTo)?.name || 'Unknown';

    addTask({
      title: title.trim(),
      description: description.trim(),
      status: 'todo',
      assigned_to: assignedTo,
      assigned_to_name: assignedUserName,
      due_date: dueDate,
      created_by: user?.id || 'unknown',
    });

    toast.success('Task created successfully');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {defaultValues ? 'Schedule Routine Task' : (canAssignOthers ? 'Assign New Task' : 'Create My Task')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Check Pond 4 Aerator"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Instructions</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed instructions..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To</Label>
              <Select 
                value={assignedTo} 
                onValueChange={setAssignedTo} 
                disabled={(!canAssignOthers && !defaultAssignee) || isLoadingUsers} 
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                min={todayStr}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {defaultValues ? 'Schedule Routine' : 'Assign Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};