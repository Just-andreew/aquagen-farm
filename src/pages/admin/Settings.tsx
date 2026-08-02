import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, Smartphone } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  bot_access?: boolean;
  telegram_chat_id?: string;
}

const Settings = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const staffList: StaffMember[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        staffList.push({
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          role: data.role || 'technician',
          bot_access: data.bot_access || false,
          telegram_chat_id: data.telegram_chat_id || ''
        });
      });
      setStaff(staffList);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleToggleBotAccess = async (userId: string, currentAccess: boolean) => {
    const newAccess = !currentAccess;
    try {
      await updateDoc(doc(db, 'users', userId), { bot_access: newAccess });
      setStaff(prev => prev.map(s => s.id === userId ? { ...s, bot_access: newAccess } : s));
      toast.success(`Bot access ${newAccess ? 'granted' : 'revoked'}`);
    } catch (error) {
      console.error("Error updating bot access:", error);
      toast.error("Failed to update bot access");
    }
  };

  const handleAddTelegramId = async (userId: string) => {
    const chatId = window.prompt("Enter the Telegram Chat ID for this user:");
    if (!chatId) return;

    try {
      await updateDoc(doc(db, 'users', userId), { telegram_chat_id: chatId });
      setStaff(prev => prev.map(s => s.id === userId ? { ...s, telegram_chat_id: chatId } : s));
      toast.success("Telegram ID updated successfully");
    } catch (error) {
      console.error("Error updating Telegram ID:", error);
      toast.error("Failed to update Telegram ID");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#14B8A6]">Settings</h1>
        <p className="text-[#94A3B8]">Manage application settings and team access controls.</p>
      </div>

      <Card className="bg-[#013333] border-[#14B8A6]/20">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><Shield className="h-5 w-5"/> Team Access</CardTitle>
          <CardDescription className="text-[#94A3B8]">Control which staff members can interact with the Telegram Expense Bot.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-[#14B8A6]">Loading staff...</div>
          ) : (
            <div className="rounded-md border border-[#14B8A6]/20 overflow-hidden">
              <Table>
                <TableHeader className="bg-black/20">
                  <TableRow className="border-[#14B8A6]/20 hover:bg-transparent">
                    <TableHead className="text-[#14B8A6]">Name</TableHead>
                    <TableHead className="text-[#14B8A6]">Role</TableHead>
                    <TableHead className="text-[#14B8A6]">Telegram ID</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Bot Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((user) => (
                    <TableRow key={user.id} className="border-[#14B8A6]/10 hover:bg-[#14B8A6]/5">
                      <TableCell className="font-medium text-slate-300">
                        {user.name}
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </TableCell>
                      <TableCell className="text-slate-400 capitalize">{user.role}</TableCell>
                      <TableCell>
                        {user.telegram_chat_id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-mono text-sm">{user.telegram_chat_id}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-slate-500 hover:text-[#14B8A6]"
                              onClick={() => handleAddTelegramId(user.id)}
                            >
                              <Smartphone className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-[#14B8A6] hover:bg-[#14B8A6]/10 h-8"
                            onClick={() => handleAddTelegramId(user.id)}
                          >
                            Add ID
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Switch 
                            checked={user.bot_access || false}
                            onCheckedChange={() => handleToggleBotAccess(user.id, user.bot_access || false)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {staff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">No staff found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
