import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Shield, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  bot_access?: boolean;
  telegram_chat_id?: string;
  telegram_name?: string;
  created_via?: string;
}

const BotAccess = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergingUser, setMergingUser] = useState<StaffMember | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

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
          telegram_name: data.telegram_name || '',
          created_via: data.created_via || ''
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

  const handleMerge = async () => {
    if (!mergingUser || !selectedTargetId) return;
    try {
      const targetUser = staff.find(s => s.id === selectedTargetId);
      if (!targetUser) return;

      // Update target user with Telegram details and grant bot access
      await updateDoc(doc(db, 'users', selectedTargetId), {
        telegram_chat_id: mergingUser.telegram_chat_id,
        telegram_name: mergingUser.telegram_name,
        bot_access: true
      });

      // Delete the auto-discovered user
      await deleteDoc(doc(db, 'users', mergingUser.id));

      toast.success(`Successfully linked ${mergingUser.telegram_name} to ${targetUser.name}`);
      setMergingUser(null);
      setSelectedTargetId('');
      fetchStaff();
    } catch (error) {
      console.error("Error merging accounts:", error);
      toast.error("Failed to link accounts");
    }
  };

  const availableTargets = staff.filter(s => 
    s.created_via !== 'telegram_auto_discovery' &&
    (s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     s.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#14B8A6]">Bot Access</h1>
        <p className="text-[#94A3B8]">Manage team access to the Telegram Expense Bot.</p>
      </div>

      <Card className="bg-[#013333] border-[#14B8A6]/20">
        <CardHeader>
          <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><Shield className="h-5 w-5"/> Telegram Approvals</CardTitle>
          <CardDescription className="text-[#94A3B8]">Review and link incoming bot connection requests.</CardDescription>
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
                        {user.created_via === 'telegram_auto_discovery' && (
                          <Badge variant="outline" className="ml-2 text-[10px] bg-yellow-900/20 text-yellow-400 border-yellow-700/50">Unlinked Telegram</Badge>
                        )}
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
                        {user.created_via === 'telegram_auto_discovery' ? (
                          <div className="flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/30 hover:bg-[#14B8A6]/20 hover:text-[#5EEAD4]"
                              onClick={() => setMergingUser(user)}
                            >
                              <LinkIcon className="w-3 h-3 mr-1" /> Link Account
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Switch 
                              checked={user.bot_access || false}
                              onCheckedChange={() => handleToggleBotAccess(user.id, user.bot_access || false)}
                              disabled={!user.telegram_chat_id}
                            />
                          </div>
                        )}
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

      <Dialog open={!!mergingUser} onOpenChange={(open) => !open && setMergingUser(null)}>
        <DialogContent className="bg-[#013333] border-[#14B8A6]/30 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-[#5EEAD4]">Link Telegram Account</DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Link <b>{mergingUser?.telegram_name}</b> to an existing web account. This will merge their Telegram access into the selected profile.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <Input 
              placeholder="Search by name or email..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#014D4D] border-[#14B8A6]/30 text-slate-200 placeholder:text-slate-500"
            />
            <div className="max-h-[250px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {availableTargets.map((t) => (
                <div 
                  key={t.id} 
                  onClick={() => setSelectedTargetId(t.id)}
                  className={`p-3 rounded-md cursor-pointer transition-colors border ${
                    selectedTargetId === t.id 
                      ? 'bg-[#14B8A6]/20 border-[#14B8A6] text-white' 
                      : 'bg-[#014D4D]/50 border-transparent text-slate-300 hover:bg-[#14B8A6]/10 hover:border-[#14B8A6]/30'
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                  {t.email && <div className="text-xs opacity-70">{t.email}</div>}
                </div>
              ))}
              {availableTargets.length === 0 && (
                <div className="text-center text-slate-500 py-4 text-sm">No accounts found.</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergingUser(null)} className="text-slate-400 hover:text-white">Cancel</Button>
            <Button onClick={handleMerge} disabled={!selectedTargetId} className="bg-[#14B8A6] text-black hover:bg-[#5EEAD4]">
              Link Accounts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BotAccess;
