import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import the connection we just made

// --- Keep your existing Interfaces exactly as they are ---
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type InventoryStatus = 'in_stock' | 'low' | 'out_of_stock';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigned_to: string;
  assigned_to_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
}

export interface Log {
  id: string;
  technician_id: string;
  technician_name: string;
  animal_type: string;
  event_type: string;
  data: any;
  timestamp: string;
  attached_file_url?: string;
}

export interface InventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  status: InventoryStatus;
  last_updated: string;
}

// (Keeping InventoryHistory simplified for Phase 1 to save time)
export interface InventoryHistoryEntry {
  id: string;
  item_id: string;
  change: number;
  reason: string;
  timestamp: string;
}

interface DataContextType {
  tasks: Task[];
  logs: Log[];
  inventory: InventoryItem[];
  inventoryHistory: InventoryHistoryEntry[];
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => Promise<void>;
  addLog: (log: Omit<Log, 'id' | 'timestamp'>) => void;
  updateLog: (id: string, updates: Partial<Log>) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  updateInventory: (id: string, quantity: number, reason?: string) => void;
  consumeInventory: (items: { item_id: string; quantity: number }[]) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'last_updated'>) => void;
  deleteInventoryItem: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  // We'll skip history syncing for the first hour to keep it simple
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistoryEntry[]>([]);

  // --- 1. SYNC DATA FROM FIREBASE (The "Listener") ---
  useEffect(() => {
    // Listener for Tasks
    const unsubscribeTasks = onSnapshot(collection(db, "tasks"), (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      // Optional: Sort by created_at in memory or use query() above
      setTasks(tasksData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    // Listener for Logs
    const unsubscribeLogs = onSnapshot(collection(db, "logs"), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Log));
      setLogs(logsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });

    // Listener for Inventory
    const unsubscribeInventory = onSnapshot(collection(db, "inventory"), (snapshot) => {
      const invData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(invData);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeLogs();
      unsubscribeInventory();
    };
  }, []);

  // --- 2. UPDATE FUNCTIONS (Writing to Firebase) ---

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    // We do NOT manually set 'id' anymore. Firebase creates it.
    await addDoc(collection(db, "tasks"), {
      ...task,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const taskRef = doc(db, "tasks", id);
    await updateDoc(taskRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  const deleteLog = async (id: string) => {
    await deleteDoc(doc(db, "logs", id));
  };
  
  const deleteInventoryItem = async (id: string) => {
    await deleteDoc(doc(db, "inventory", id));
  };

  const addLog = async (log: Omit<Log, 'id' | 'timestamp'>) => {
    await addDoc(collection(db, "logs"), {
      ...log,
      timestamp: new Date().toISOString(),
    });
  };

const updateLog = async (id: string, updates: Partial<Log>) => {
    const logRef = doc(db, "logs", id);
    await updateDoc(logRef, {
      ...updates,
    });
  };

  const addInventoryItem = async (item: Omit<InventoryItem, 'id' | 'last_updated'>) => {
    await addDoc(collection(db, "inventory"), {
      ...item,
      last_updated: new Date().toISOString(),
    });
  };

  const updateInventory = async (id: string, quantity: number, reason: string = 'Manual adjustment') => {
    // 1. Find the current item to calculate new quantity
    const item = inventory.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(0, item.quantity + quantity);
    const newStatus = newQuantity === 0 ? 'out_of_stock' : newQuantity < 20 ? 'low' : 'in_stock';

    // 2. Update Firebase
    const itemRef = doc(db, "inventory", id);
    await updateDoc(itemRef, {
      quantity: newQuantity,
      status: newStatus,
      last_updated: new Date().toISOString()
    });
  };

  const consumeInventory = (items: { item_id: string; quantity: number }[]) => {
    items.forEach(({ item_id, quantity }) => {
      updateInventory(item_id, -quantity, "Consumed by task/log");
    });
  };

  return (
    <DataContext.Provider
      value={{ tasks, logs, inventory, inventoryHistory, addTask, updateTask, deleteTask, deleteLog, deleteInventoryItem, addLog, updateLog, updateInventory, consumeInventory, addInventoryItem }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};