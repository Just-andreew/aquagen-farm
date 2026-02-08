import { useState, useEffect } from 'react';
import { Task, useData } from '@/contexts/DataContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EditTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

interface UserOption {
  id: string;
  name: string;
}

export const EditTaskModal = ({ open, onOpenChange, task }: EditTaskModalProps) => {
  const { updateTask } = useData();
  
  // Initialize state with the existing task data
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Fetch users (Same logic as TaskModal)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!open) return;
      setIsLoadingUsers(true);
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersList: UserOption[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name) {
            usersList.push({ id: doc.id, name: data.name });
          }
        });
        setAvailableUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    const assignedUserName = availableUsers.find(u => u.id === assignedTo)?.name || task.assigned_to_name;

    // Call updateTask instead of addTask
    await updateTask(task.id, {
      title: title.trim(),
      description: description.trim(),
      assigned_to: assignedTo,
      assigned_to_name: assignedUserName,
    });

    toast.success('Task updated successfully');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-assignedTo">Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={isLoadingUsers}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingUsers ? "Loading..." : "Select team member"} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};