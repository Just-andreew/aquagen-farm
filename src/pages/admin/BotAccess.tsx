import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  bot_access?: boolean;
  telegram_chat_id?: string;
  telegram_name?: string;
}

const BotAccess = () => {
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
          telegram_chat_id: data.telegram_chat_id || '',
          telegram_name: data.telegram_name || ''
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#14B8A6]">Bot Access</h1>
        <p className="text-[#94A3B8]">Manage team access to the Telegram Expense Bot.</p>
      </div>

      <Card className="bg-[#013333] border-[#14B8A6]/20">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><Shield className="h-5 w-5"/> Telegram Approvals</CardTitle>
          <CardDescription className="text-[#94A3B8]">Review and approve incoming bot connection requests.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-[#14B8A6]">Loading staff...</div>
          ) : (
            <div className="rounded-md border border-[#14B8A6]/20 overflow-hidden">
              <Table>
                <TableHeader className="bg-black/20">
                  <TableRow className="border-[#14B8A6]/20 hover:bg-transparent">
                    <TableHead className="text-[#14B8A6]">Name (System)</TableHead>
                    <TableHead className="text-[#14B8A6]">Telegram Name</TableHead>
                    <TableHead className="text-[#14B8A6]">Role</TableHead>
                    <TableHead className="text-[#14B8A6] text-right">Bot Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((user) => (
                    <TableRow key={user.id} className="border-[#14B8A6]/10 hover:bg-[#14B8A6]/5">
                      <TableCell className="font-medium text-slate-300">
                        {user.name}
                        {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
                      </TableCell>
                      <TableCell>
                        {user.telegram_name ? (
                          <span className="text-slate-300">{user.telegram_name}</span>
                        ) : (
                          <span className="text-slate-600 text-sm italic">Not linked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize bg-[#14B8A6]/10 text-[#5EEAD4] border-[#14B8A6]/20 text-[10px]">
                          {user.role.replace('_', ' ')}
                        </Badge>
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

export default BotAccess;
