import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, UserCog, Pencil, Trash2, AlertCircle, Briefcase, Repeat, Play, Plus, Clock, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { TaskModal } from '@/components/TaskModal';

// --- TYPES ---
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'farm_technician';
}

interface Routine {
  id: string;
  title: string;
  description: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Ad-hoc'; // NEW
  target_time: string; // NEW (e.g., "08:00")
}

const Management = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'team' | 'routines'>('team');
  
  // Data State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);

  // Selection State
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [selectedRoutineValues, setSelectedRoutineValues] = useState<{title: string, description: string} | undefined>(undefined);
  
  // Edit User State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<string>('');

  // Create Routine State
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineDesc, setNewRoutineDesc] = useState('');
  const [newRoutineFreq, setNewRoutineFreq] = useState<string>('Daily'); // NEW
  const [newRoutineTime, setNewRoutineTime] = useState(''); // NEW

  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    fetchUsers();
    fetchRoutines();
  }, []);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({ id: doc.id, name: data.name || 'Unknown', email: data.email || 'No Email', role: data.role || 'farm_technician' } as UserProfile);
      });
      setUsers(usersList);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchRoutines = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "routines"));
      const list: Routine[] = [];
      querySnapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() } as Routine));
      setRoutines(list);
    } catch (error) { console.error("Error fetching routines:", error); }
  };

  // --- 2. USER ACTIONS ---
  const handleAssignTaskToUser = (userId: string) => {
    setSelectedUser(userId);
    setSelectedRoutineValues(undefined);
    setIsTaskModalOpen(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setCurrentUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setIsEditOpen(true);
  };

  const saveUserChanges = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "users", currentUser.id), { name: editName, email: editEmail, role: editRole });
      setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, name: editName, email: editEmail, role: editRole as any } : u));
      toast.success("Profile updated");
      setIsEditOpen(false);
    } catch (error) { toast.error("Update failed"); }
  };

  // --- 3. ROUTINE ACTIONS ---
  const handleCreateRoutine = async () => {
    if (!newRoutineTitle.trim()) return;
    try {
      const newRoutineData = {
        title: newRoutineTitle,
        description: newRoutineDesc,
        frequency: newRoutineFreq,
        target_time: newRoutineTime,
        created_at: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "routines"), newRoutineData);
      
      setRoutines([...routines, { id: docRef.id, ...newRoutineData } as Routine]);
      
      setIsRoutineModalOpen(false);
      // Reset form
      setNewRoutineTitle('');
      setNewRoutineDesc('');
      setNewRoutineFreq('Daily');
      setNewRoutineTime('');
      toast.success("Routine SOP saved");
    } catch (error) { toast.error("Failed to save routine"); }
  };

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm("Delete this routine template?")) return;
    try {
      await deleteDoc(doc(db, "routines", id));
      setRoutines(prev => prev.filter(r => r.id !== id));
      toast.success("Routine deleted");
    } catch (error) { toast.error("Failed to delete"); }
  };

  const handleRunRoutine = (routine: Routine) => {
    // We pass the title, description, AND imply the time in the instructions
    const timeInstructions = routine.target_time ? `\n\n[SOP Schedule: ${routine.frequency} at ${routine.target_time}]` : '';
    
    setSelectedRoutineValues({ 
        title: routine.title, 
        description: routine.description + timeInstructions
    });
    setSelectedUser(undefined);
    setIsTaskModalOpen(true);
  };

  // --- RENDER HELPERS ---
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'supervisor': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-[#14B8A6]/10 text-[#5EEAD4] border-[#14B8A6]/20';
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'supervisor') {
    return <div className="p-8 text-center text-[#94A3B8]">Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER & TABS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#14B8A6]">Command Center</h1>
          <p className="text-[#94A3B8]">Manage personnel and standard operating procedures</p>
        </div>
        
        <div className="flex p-1 bg-[#013333] border border-[#14B8A6]/30 rounded-lg">
            <button onClick={() => setActiveTab('team')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'team' ? 'bg-[#14B8A6] text-[#013333]' : 'text-[#94A3B8] hover:text-white'}`}>
                Team
            </button>
            <button onClick={() => setActiveTab('routines')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'routines' ? 'bg-[#14B8A6] text-[#013333]' : 'text-[#94A3B8] hover:text-white'}`}>
                <Repeat className="h-4 w-4" /> Routines
            </button>
        </div>
      </div>

      {/* --- TAB 1: TEAM MANAGEMENT --- */}
      {activeTab === 'team' && (
        <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader><CardTitle className="flex items-center gap-2 text-[#5EEAD4]"><UserCog className="h-5 w-5" /> Active Personnel</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {users.map((staff) => (
                <div key={staff.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-black/20 border border-[#14B8A6]/10 hover:border-[#14B8A6]/30 transition-all gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-[#14B8A6]/10 flex items-center justify-center text-[#14B8A6] font-bold shrink-0">{staff.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <h3 className="font-semibold text-white">{staff.name}</h3>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`${getRoleBadgeColor(staff.role)} capitalize text-[10px]`}>{staff.role.replace('_', ' ')}</Badge>
                                <span className="text-sm text-[#94A3B8] hidden sm:inline">{staff.email}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                         <Button size="sm" className="bg-[#14B8A6]/10 text-[#5EEAD4] border border-[#14B8A6]/30 hover:bg-[#14B8A6] hover:text-[#013333]" onClick={() => handleAssignTaskToUser(staff.id)}>
                            <Briefcase className="h-3.5 w-3.5 mr-1" /> Assign Task
                        </Button>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => handleEditUser(staff)}><Pencil className="h-4 w-4" /></Button>
                    </div>
                </div>
                ))}
            </CardContent>
        </Card>
      )}

      {/* --- TAB 2: ROUTINES (SOPs) --- */}
      {activeTab === 'routines' && (
         <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setIsRoutineModalOpen(true)} className="bg-[#14B8A6] text-[#013333] font-bold hover:bg-[#14B8A6]/90">
                    <Plus className="h-4 w-4 mr-2" /> Create Routine
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {routines.map((routine) => (
                    <Card key={routine.id} className="bg-[#013333] border-[#14B8A6]/20 hover:border-[#14B8A6]/50 transition-all group">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-[#5EEAD4]">{routine.title}</CardTitle>
                                    
                                    {/* FREQUENCY & TIME BADGES */}
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="text-xs border-[#14B8A6]/30 text-[#14B8A6] gap-1">
                                            <CalendarClock className="h-3 w-3" /> {routine.frequency}
                                        </Badge>
                                        {routine.target_time && (
                                            <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400 gap-1">
                                                <Clock className="h-3 w-3" /> {routine.target_time}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteRoutine(routine.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <CardDescription className="text-[#94A3B8] line-clamp-2 mt-2">{routine.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full bg-[#014D4D] text-[#5EEAD4] hover:bg-[#14B8A6] hover:text-[#013333] transition-colors" onClick={() => handleRunRoutine(routine)}>
                                <Play className="h-4 w-4 mr-2" /> Run Routine
                            </Button>
                        </CardContent>
                    </Card>
                ))}
                
                {routines.length === 0 && (
                    <div className="col-span-full text-center py-12 text-[#94A3B8] border-2 border-dashed border-[#14B8A6]/10 rounded-lg">
                        <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No routines created yet.</p>
                        <p className="text-sm">Create templates for recurring tasks like "Morning Feeding" or "Weekly Maintenance".</p>
                    </div>
                )}
            </div>
         </div>
      )}

      {/* --- MODALS --- */}
      <TaskModal open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen} defaultAssignee={selectedUser} defaultValues={selectedRoutineValues} />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-[#013333] border-[#14B8A6]">
            <DialogHeader><DialogTitle className="text-[#5EEAD4]">Edit Personnel</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2"><Label className="text-[#94A3B8]">Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" /></div>
                <div className="space-y-2"><Label className="text-[#94A3B8]">Role</Label>
                    <Select value={editRole} onValueChange={setEditRole}><SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#014D4D] border-[#14B8A6]"><SelectItem value="farm_technician">Technician</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setIsEditOpen(false)} className="text-[#94A3B8]">Cancel</Button><Button onClick={saveUserChanges} className="bg-[#14B8A6] text-[#013333]">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. NEW ROUTINE MODAL (UPDATED) */}
      <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
        <DialogContent className="bg-[#013333] border-[#14B8A6]">
            <DialogHeader><DialogTitle className="text-[#5EEAD4]">Create New Routine</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Routine Title</Label>
                    <Input placeholder="e.g. Morning Feeding" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                </div>
                
                {/* FREQUENCY & TIME INPUTS */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-[#94A3B8]">Frequency</Label>
                        <Select value={newRoutineFreq} onValueChange={setNewRoutineFreq}>
                            <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-[#014D4D] border-[#14B8A6]">
                                <SelectItem value="Daily">Daily</SelectItem>
                                <SelectItem value="Weekly">Weekly</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                <SelectItem value="Ad-hoc">Ad-hoc</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[#94A3B8]">Target Time</Label>
                        <Input type="time" value={newRoutineTime} onChange={(e) => setNewRoutineTime(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Standard Instructions</Label>
                    <Textarea placeholder="Describe the standard procedure..." value={newRoutineDesc} onChange={(e) => setNewRoutineDesc(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" rows={4} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsRoutineModalOpen(false)} className="text-[#94A3B8]">Cancel</Button>
                <Button onClick={handleCreateRoutine} className="bg-[#14B8A6] text-[#013333]">Save Routine</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Management;