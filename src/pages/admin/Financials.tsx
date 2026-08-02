import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { createInvoiceTransaction } from '@/lib/firebase/transactions';
import { useAuth } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Trash2, FileText, DollarSign, CreditCard, Building2, Receipt } from 'lucide-react';

// --- TYPES ---
interface LedgerEntry {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  amount: number;
  user_id: string;
  status: string;
  invoice_id?: string;
}

interface LineItem {
  item: string;
  qty: number;
  price: number;
}

const Financials = () => {
  const { user } = useAuth();
  
  // --- STATE: LEDGER ---
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // --- STATE: VOID INVOICE MODAL ---
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  // --- STATE: QUICK POS ---
  const [posCategory, setPosCategory] = useState('');
  const [posQty, setPosQty] = useState(1);
  const [posPrice, setPosPrice] = useState(0);
  const [posPayment, setPosPayment] = useState('Cash');

  // --- STATE: B2B INVOICE ---
  const [b2bClient, setB2bClient] = useState('');
  const [b2bKra, setB2bKra] = useState('');
  const [b2bTerms, setB2bTerms] = useState('Net 30');
  const [b2bItems, setB2bItems] = useState<LineItem[]>([{ item: '', qty: 1, price: 0 }]);
  
  const b2bSubtotal = b2bItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
  const b2bTax = b2bSubtotal * 0.16; // 16% VAT
  const b2bTotal = b2bSubtotal + b2bTax;

  // --- STATE: EXPENSES ---
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState(0);
  const [expDate, setExpDate] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expFile, setExpFile] = useState<File | null>(null);
  const [isUploadingExp, setIsUploadingExp] = useState(false);

  // --- COMPUTED METRICS ---
  const totalRevenue = ledgerData
    .filter(entry => entry.type === 'Income' && !['Void', 'Reversed'].includes(entry.status))
    .reduce((acc, curr) => acc + curr.amount, 0);

  // --- FETCH DATA ---
  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const salesSnap = await getDocs(collection(db, 'sales'));
      const expSnap = await getDocs(collection(db, 'expenses'));
      
      const entries: LedgerEntry[] = [];
      
      salesSnap.forEach(doc => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          date: data.date || data.created_at,
          type: 'Income',
          category: data.category || (data.type === 'B2B' ? 'B2B Invoice' : 'General Sale'),
          amount: data.total || data.amount || 0,
          user_id: data.user_id || 'Unknown',
          status: data.status || 'Paid',
          invoice_id: data.invoice_id
        });
      });

      expSnap.forEach(doc => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          date: data.date || data.created_at,
          type: 'Expense',
          category: data.category || 'General Expense',
          amount: data.amount || 0,
          user_id: data.user_id || 'Unknown',
          status: data.status === 'draft' ? 'Draft' : (data.status || 'Paid')
        });
      });

      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLedgerData(entries);
    } catch (error) {
      console.error("Error fetching ledger:", error);
      toast.error("Failed to load ledger data");
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // --- HANDLERS ---
  const handleQuickPOS = async () => {
    if (!posCategory || posQty <= 0 || posPrice <= 0) {
      return toast.error("Please fill all fields correctly.");
    }
    try {
      const status = posPayment === 'Credit' ? 'Pending' : 'Paid';
      await createInvoiceTransaction({
        type: 'POS',
        category: posCategory,
        quantity: posQty,
        unit_price: posPrice,
        amount: posQty * posPrice,
        payment_method: posPayment,
        status: status,
        user_id: user?.id,
      });
      toast.success("POS Sale recorded successfully!");
      setPosCategory(''); setPosQty(1); setPosPrice(0); setPosPayment('Cash');
      fetchLedger();
    } catch (error: any) {
      toast.error(error.message || "Failed to record sale.");
    }
  };

  const handleB2BInvoice = async (status: 'Draft' | 'Pending') => {
    if (!b2bClient || b2bItems.length === 0 || b2bItems.some(i => !i.item || i.qty <= 0 || i.price <= 0)) {
      return toast.error("Please fill all required client and item fields.");
    }
    try {
      await createInvoiceTransaction({
        type: 'B2B',
        client_name: b2bClient,
        kra_pin: b2bKra,
        payment_terms: b2bTerms,
        items: b2bItems,
        subtotal: b2bSubtotal,
        tax: b2bTax,
        total: b2bTotal,
        status: status,
        user_id: user?.id,
      });
      toast.success(`B2B Invoice saved as ${status}!`);
      setB2bClient(''); setB2bKra(''); setB2bTerms('Net 30'); setB2bItems([{ item: '', qty: 1, price: 0 }]);
      fetchLedger();
    } catch (error: any) {
      toast.error(error.message || "Failed to save invoice.");
    }
  };

  const handleExpense = async () => {
    if (!expCategory || expAmount <= 0 || !expDate) {
      return toast.error("Please fill required expense fields.");
    }
    setIsUploadingExp(true);
    try {
      let receiptUrl = '';
      if (expFile) {
        const fileRef = ref(storage, `receipts/${Date.now()}_${expFile.name}`);
        const snapshot = await uploadBytes(fileRef, expFile);
        receiptUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, 'expenses'), {
        category: expCategory,
        amount: expAmount,
        date: expDate,
        description: expDesc,
        receiptUrl: receiptUrl,
        user_id: user?.id,
        created_at: new Date().toISOString()
      });
      
      toast.success("Expense logged successfully!");
      setExpCategory(''); setExpAmount(0); setExpDate(''); setExpDesc(''); setExpFile(null);
      fetchLedger();
    } catch (error) {
      toast.error("Failed to log expense.");
    } finally {
      setIsUploadingExp(false);
    }
  };

  const confirmVoid = async () => {
    if (!voidInvoiceId) return;
    try {
      await updateDoc(doc(db, 'sales', voidInvoiceId), { status: 'Void' });
      toast.success("Invoice voided successfully");
      fetchLedger();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to void invoice. You might lack permissions.");
    } finally {
      setVoidInvoiceId(null);
      setIsVoidModalOpen(false);
    }
  };

  const confirmApprove = async (id: string, type: string) => {
    try {
      const collectionName = type === 'Expense' ? 'expenses' : 'sales';
      await updateDoc(doc(db, collectionName, id), { status: 'Paid' });
      toast.success("Draft approved successfully!");
      fetchLedger();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to approve draft.");
    }
  };

  // --- RENDER HELPERS ---
  const validLedgerEntries = ledgerData.filter(e => e.status !== 'Draft');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Paid': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">{status}</Badge>;
      case 'Pending': return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">{status}</Badge>;
      case 'Draft': return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">{status}</Badge>;
      case 'Void': 
      case 'Reversed': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#14B8A6]">Financials</h1>
        <p className="text-[#94A3B8]">Manage ledgers, accounts receivable, and accounts payable.</p>
      </div>

      <Tabs defaultValue="ledger" className="w-full">
        <TabsList className="bg-[#013333] border border-[#14B8A6]/30">
          <TabsTrigger value="ledger" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333]">Ledger</TabsTrigger>
          <TabsTrigger value="sales" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333]">Sales (AR)</TabsTrigger>
          <TabsTrigger value="purchases" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333]">Purchases (AP)</TabsTrigger>
          <TabsTrigger value="drafts" className="data-[state=active]:bg-[#14B8A6] data-[state=active]:text-[#013333]">Drafts</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: LEDGER --- */}
        <TabsContent value="ledger" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="bg-[#014D4D] border-[#14B8A6]/30 shadow-none">
              <CardContent className="p-6">
                <p className="text-sm text-slate-300 mb-1">Total Revenue (Valid)</p>
                <p className="text-3xl font-bold text-[#5EEAD4]">KES {totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
          
          <Card className="bg-[#013333] border-[#14B8A6]/20">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><FileText className="h-5 w-5"/> P&L Command Center</CardTitle>
              <CardDescription className="text-[#94A3B8]">High-level view of all income and expenses.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLedger ? (
                <div className="text-center py-8 text-[#14B8A6]">Loading ledger data...</div>
              ) : (
                <div className="rounded-md border border-[#14B8A6]/20 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-black/20">
                      <TableRow className="border-[#14B8A6]/20 hover:bg-transparent">
                        <TableHead className="text-[#14B8A6]">Date</TableHead>
                        <TableHead className="text-[#14B8A6]">Ref</TableHead>
                        <TableHead className="text-[#14B8A6]">Category</TableHead>
                        <TableHead className="text-[#14B8A6]">Status</TableHead>
                        <TableHead className="text-[#14B8A6] text-right">Amount (KES)</TableHead>
                        <TableHead className="text-[#14B8A6] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validLedgerEntries.map((entry) => (
                        <TableRow key={entry.id} className="border-[#14B8A6]/10 hover:bg-[#14B8A6]/5">
                          <TableCell className="text-slate-300">{new Date(entry.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-slate-400 text-xs font-mono">{entry.invoice_id || 'N/A'}</TableCell>
                          <TableCell className="text-slate-300">
                            <div className="flex flex-col">
                              <span>{entry.category}</span>
                              <span className={`text-[10px] ${entry.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>{entry.type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(entry.status)}</TableCell>
                          <TableCell className={`text-right font-bold ${entry.type === 'Income' && !['Void', 'Reversed'].includes(entry.status) ? 'text-emerald-400' : entry.type === 'Expense' ? 'text-rose-400' : 'text-slate-500 line-through'}`}>
                            {entry.type === 'Income' ? '+' : '-'}{entry.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right flex justify-end gap-2">
                            {entry.type === 'Income' && (entry.status === 'Paid' || entry.status === 'Pending') && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white"
                                onClick={() => { setVoidInvoiceId(entry.id); setIsVoidModalOpen(true); }}
                              >
                                Void
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {ledgerData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-slate-500">No transactions found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB 2: SALES (AR) --- */}
        <TabsContent value="sales" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* QUICK POS */}
            <Card className="bg-[#013333] border-[#14B8A6]/20 lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><DollarSign className="h-5 w-5"/> Quick POS</CardTitle>
                <CardDescription className="text-[#94A3B8]">Fast checkout for walk-in sales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">Product Category</Label>
                  <Select value={posCategory} onValueChange={setPosCategory}>
                    <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue placeholder="Select Product" /></SelectTrigger>
                    <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                      <SelectItem value="Fingerlings">Fingerlings</SelectItem>
                      <SelectItem value="Adult Fish">Adult Fish</SelectItem>
                      <SelectItem value="Fish Feed">Fish Feed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Qty</Label>
                    <Input type="number" min="1" value={posQty} onChange={(e) => setPosQty(Number(e.target.value))} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Unit Price</Label>
                    <Input type="number" min="0" value={posPrice} onChange={(e) => setPosPrice(Number(e.target.value))} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">Payment Method</Label>
                  <Select value={posPayment} onValueChange={setPosPayment}>
                    <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="M-Pesa">M-Pesa</SelectItem>
                      <SelectItem value="Credit">Credit (AR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-4 border-t border-[#14B8A6]/20 flex justify-between items-center">
                  <span className="text-[#94A3B8]">Total:</span>
                  <span className="text-2xl font-bold text-[#5EEAD4]">KES {(posQty * posPrice).toLocaleString()}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-[#14B8A6] text-[#013333] hover:bg-[#14B8A6]/90 font-bold" onClick={handleQuickPOS}>Process Sale</Button>
              </CardFooter>
            </Card>

            {/* B2B INVOICE ENGINE */}
            <Card className="bg-[#013333] border-[#14B8A6]/20 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><Building2 className="h-5 w-5"/> B2B Invoice Engine</CardTitle>
                <CardDescription className="text-[#94A3B8]">Generate corporate invoices and track receivables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Client Name</Label>
                    <Input placeholder="e.g. Acme Hotels" value={b2bClient} onChange={(e) => setB2bClient(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">KRA PIN (Optional)</Label>
                    <Input placeholder="P000000000X" value={b2bKra} onChange={(e) => setB2bKra(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#94A3B8]">Payment Terms</Label>
                    <Select value={b2bTerms} onValueChange={setB2bTerms}>
                      <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[#94A3B8]">Line Items</Label>
                  {b2bItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input placeholder="Description" value={item.item} onChange={(e) => {
                        const newItems = [...b2bItems]; newItems[index].item = e.target.value; setB2bItems(newItems);
                      }} className="bg-[#014D4D] border-[#14B8A6]/30 text-white flex-1" />
                      <Input type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => {
                        const newItems = [...b2bItems]; newItems[index].qty = Number(e.target.value); setB2bItems(newItems);
                      }} className="bg-[#014D4D] border-[#14B8A6]/30 text-white w-24" />
                      <Input type="number" min="0" placeholder="Price" value={item.price} onChange={(e) => {
                        const newItems = [...b2bItems]; newItems[index].price = Number(e.target.value); setB2bItems(newItems);
                      }} className="bg-[#014D4D] border-[#14B8A6]/30 text-white w-32" />
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400" onClick={() => {
                        if (b2bItems.length > 1) {
                          setB2bItems(b2bItems.filter((_, i) => i !== index));
                        }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="border-[#14B8A6]/30 text-[#14B8A6] hover:bg-[#14B8A6]/10" onClick={() => setB2bItems([...b2bItems, { item: '', qty: 1, price: 0 }])}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </div>

                <div className="bg-black/20 p-4 rounded-lg border border-[#14B8A6]/10 space-y-2">
                  <div className="flex justify-between text-sm text-slate-300"><span>Subtotal:</span><span>KES {b2bSubtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm text-slate-300"><span>Tax (16% VAT):</span><span>KES {b2bTax.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-lg text-[#5EEAD4] pt-2 border-t border-[#14B8A6]/20"><span>Grand Total:</span><span>KES {b2bTotal.toLocaleString()}</span></div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-4 border-t border-[#14B8A6]/10 pt-6">
                <Button variant="outline" className="border-[#14B8A6]/30 text-[#14B8A6] hover:bg-[#14B8A6]/10" onClick={() => handleB2BInvoice('Draft')}>Save Draft</Button>
                <Button className="bg-[#14B8A6] text-[#013333] hover:bg-[#14B8A6]/90 font-bold" onClick={() => handleB2BInvoice('Pending')}>Finalize & Issue</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB 3: PURCHASES (AP) --- */}
        <TabsContent value="purchases" className="mt-6">
          <Card className="bg-[#013333] border-[#14B8A6]/20 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><CreditCard className="h-5 w-5"/> Log Operational Expense</CardTitle>
              <CardDescription className="text-[#94A3B8]">Record supplier purchases, utility bills, and other expenses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">Category</Label>
                  <Select value={expCategory} onValueChange={setExpCategory}>
                    <SelectTrigger className="bg-[#014D4D] border-[#14B8A6]/30 text-white"><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent className="bg-[#014D4D] border-[#14B8A6] text-white">
                      <SelectItem value="Feed">Fish Feed</SelectItem>
                      <SelectItem value="Hardware">Hardware/Maintenance</SelectItem>
                      <SelectItem value="Logistics">Logistics/Transport</SelectItem>
                      <SelectItem value="Utilities">Utilities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">Date</Label>
                  <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#94A3B8]">Amount (KES)</Label>
                <Input type="number" min="0" value={expAmount} onChange={(e) => setExpAmount(Number(e.target.value))} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-[#94A3B8]">Description</Label>
                <Input placeholder="e.g. 10 bags of grower feed from Supplier X" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="bg-[#014D4D] border-[#14B8A6]/30 text-white" />
              </div>
              
              <div className="space-y-2 pt-2">
                <Label className="text-[#94A3B8]">Receipt / Invoice Upload</Label>
                <div className="border-2 border-dashed border-[#14B8A6]/30 rounded-lg p-6 text-center hover:bg-[#14B8A6]/5 transition-colors">
                  <input type="file" id="receipt" className="hidden" onChange={(e) => setExpFile(e.target.files?.[0] || null)} accept="image/*,.pdf" />
                  <label htmlFor="receipt" className="cursor-pointer flex flex-col items-center gap-2">
                    <Receipt className="h-8 w-8 text-[#14B8A6]/50" />
                    <span className="text-sm text-slate-300">
                      {expFile ? expFile.name : "Click to upload receipt image or PDF"}
                    </span>
                  </label>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-[#14B8A6] text-[#013333] hover:bg-[#14B8A6]/90 font-bold" onClick={handleExpense} disabled={isUploadingExp}>
                {isUploadingExp ? "Uploading & Saving..." : "Log Expense"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --- TAB 4: DRAFTS --- */}
        <TabsContent value="drafts" className="mt-6">
          <Tabs defaultValue="purchases_drafts" className="w-full">
            <TabsList className="bg-[#014D4D] border border-[#14B8A6]/30 mb-6">
              <TabsTrigger value="sales_drafts" className="data-[state=active]:bg-[#5EEAD4] data-[state=active]:text-[#013333]">Sales Drafts</TabsTrigger>
              <TabsTrigger value="purchases_drafts" className="data-[state=active]:bg-[#5EEAD4] data-[state=active]:text-[#013333]">Purchases Drafts</TabsTrigger>
            </TabsList>

            <TabsContent value="sales_drafts">
              <Card className="bg-[#013333] border-[#14B8A6]/20">
                <CardHeader>
                  <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><DollarSign className="h-5 w-5"/> Sales Drafts (AR)</CardTitle>
                  <CardDescription className="text-[#94A3B8]">Pending sales invoices awaiting finalization.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-[#14B8A6]/20 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-black/20">
                        <TableRow className="border-[#14B8A6]/20 hover:bg-transparent">
                          <TableHead className="text-[#14B8A6]">Date</TableHead>
                          <TableHead className="text-[#14B8A6]">Category</TableHead>
                          <TableHead className="text-[#14B8A6]">Status</TableHead>
                          <TableHead className="text-[#14B8A6] text-right">Amount (KES)</TableHead>
                          <TableHead className="text-[#14B8A6] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.filter(e => e.type === 'Income' && e.status === 'Draft').map((entry) => (
                          <TableRow key={entry.id} className="border-[#14B8A6]/10 hover:bg-[#14B8A6]/5">
                            <TableCell className="text-slate-300">{new Date(entry.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-slate-300">{entry.category}</TableCell>
                            <TableCell>{getStatusBadge(entry.status)}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-400">+{entry.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right flex justify-end gap-2">
                              <Button variant="outline" size="sm" className="border-[#14B8A6]/30 text-[#14B8A6] hover:bg-[#14B8A6] hover:text-[#013333]" onClick={() => confirmApprove(entry.id, entry.type)}>
                                Approve
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {ledgerData.filter(e => e.type === 'Income' && e.status === 'Draft').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">No sales drafts found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases_drafts">
              <Card className="bg-[#013333] border-[#14B8A6]/20">
                <CardHeader>
                  <CardTitle className="text-[#5EEAD4] flex items-center gap-2"><CreditCard className="h-5 w-5"/> Purchases Drafts (AP)</CardTitle>
                  <CardDescription className="text-[#94A3B8]">Pending expenses awaiting approval.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-[#14B8A6]/20 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-black/20">
                        <TableRow className="border-[#14B8A6]/20 hover:bg-transparent">
                          <TableHead className="text-[#14B8A6]">Date</TableHead>
                          <TableHead className="text-[#14B8A6]">Category</TableHead>
                          <TableHead className="text-[#14B8A6]">Status</TableHead>
                          <TableHead className="text-[#14B8A6] text-right">Amount (KES)</TableHead>
                          <TableHead className="text-[#14B8A6] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerData.filter(e => e.type === 'Expense' && e.status === 'Draft').map((entry) => (
                          <TableRow key={entry.id} className="border-[#14B8A6]/10 hover:bg-[#14B8A6]/5">
                            <TableCell className="text-slate-300">{new Date(entry.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-slate-300">{entry.category}</TableCell>
                            <TableCell>{getStatusBadge(entry.status)}</TableCell>
                            <TableCell className="text-right font-bold text-rose-400">-{entry.amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right flex justify-end gap-2">
                              <Button variant="outline" size="sm" className="border-[#14B8A6]/30 text-[#14B8A6] hover:bg-[#14B8A6] hover:text-[#013333]" onClick={() => confirmApprove(entry.id, entry.type)}>
                                Approve
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {ledgerData.filter(e => e.type === 'Expense' && e.status === 'Draft').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">No purchases drafts found.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

      </Tabs>

      {/* --- VOID CONFIRMATION MODAL --- */}
      <AlertDialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
        <AlertDialogContent className="bg-[#013333] border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">Void Invoice?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94A3B8]">
              This action is permanent and cannot be undone. The invoice will be permanently marked as Void, and its value will be removed from your total revenue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-[#014D4D] text-white border-transparent hover:bg-black/20">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 text-white hover:bg-red-600 border-none" onClick={confirmVoid}>
              Confirm Void
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Financials;
