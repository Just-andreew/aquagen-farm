import React, { createContext, useContext, useState, useEffect } from 'react';

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
  consumed_inventory?: { item_id: string; quantity: number }[];
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

export interface InventoryHistoryEntry {
  id: string;
  item_id: string;
  item_name: string;
  change: number;
  changed_by: string;
  changed_by_name: string;
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
  addLog: (log: Omit<Log, 'id' | 'timestamp'>) => void;
  updateInventory: (id: string, quantity: number, reason?: string, userId?: string, userName?: string) => void;
  consumeInventory: (items: { item_id: string; quantity: number }[]) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'last_updated'>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const INITIAL_TASKS: Task[] = [
  {
    id: '1',
    title: 'Feed morning batch',
    description: 'Distribute feed to ponds 1-5',
    status: 'todo',
    assigned_to: '2',
    assigned_to_name: 'John Technician',
    created_by: '1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Check water pH levels',
    description: 'Test and record pH in all ponds',
    status: 'in_progress',
    assigned_to: '2',
    assigned_to_name: 'John Technician',
    created_by: '1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: '1', item_name: 'Fish Feed Premium', quantity: 500, unit: 'kg', status: 'in_stock', last_updated: new Date().toISOString() },
  { id: '2', item_name: 'Oxygen Tablets', quantity: 15, unit: 'boxes', status: 'low', last_updated: new Date().toISOString() },
  { id: '3', item_name: 'pH Test Strips', quantity: 0, unit: 'packs', status: 'out_of_stock', last_updated: new Date().toISOString() },
  { id: '4', item_name: 'Water Conditioner', quantity: 80, unit: 'liters', status: 'in_stock', last_updated: new Date().toISOString() },
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistoryEntry[]>([]);

  useEffect(() => {
    const storedTasks = localStorage.getItem('aquagen_tasks');
    const storedLogs = localStorage.getItem('aquagen_logs');
    const storedInventory = localStorage.getItem('aquagen_inventory');
    const storedHistory = localStorage.getItem('aquagen_inventory_history');

    setTasks(storedTasks ? JSON.parse(storedTasks) : INITIAL_TASKS);
    setLogs(storedLogs ? JSON.parse(storedLogs) : []);
    setInventory(storedInventory ? JSON.parse(storedInventory) : INITIAL_INVENTORY);
    setInventoryHistory(storedHistory ? JSON.parse(storedHistory) : []);
  }, []);

  useEffect(() => {
    localStorage.setItem('aquagen_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('aquagen_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('aquagen_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('aquagen_inventory_history', JSON.stringify(inventoryHistory));
  }, [inventoryHistory]);

  const addTask = (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, ...updates, updated_at: new Date().toISOString() } : task
      )
    );
  };

  const addLog = (log: Omit<Log, 'id' | 'timestamp'>) => {
    const newLog: Log = {
      ...log,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const updateInventory = (id: string, quantity: number, reason: string = 'Manual adjustment', userId: string = 'system', userName: string = 'System') => {
    setInventory(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + quantity;
          
          // Track history
          const historyEntry: InventoryHistoryEntry = {
            id: Date.now().toString(),
            item_id: id,
            item_name: item.item_name,
            change: quantity,
            changed_by: userId,
            changed_by_name: userName,
            reason,
            timestamp: new Date().toISOString(),
          };
          setInventoryHistory(prev => [historyEntry, ...prev]);
          
          return {
            ...item,
            quantity: Math.max(0, newQuantity),
            status: newQuantity === 0 ? 'out_of_stock' : newQuantity < 20 ? 'low' : 'in_stock',
            last_updated: new Date().toISOString(),
          };
        }
        return item;
      })
    );
  };

  const addInventoryItem = (item: Omit<InventoryItem, 'id' | 'last_updated'>) => {
    const newItem: InventoryItem = {
      ...item,
      id: Date.now().toString(),
      last_updated: new Date().toISOString(),
    };
    setInventory(prev => [...prev, newItem]);
  };

  const consumeInventory = (items: { item_id: string; quantity: number }[]) => {
    items.forEach(({ item_id, quantity }) => {
      updateInventory(item_id, -quantity);
    });
  };

  return (
    <DataContext.Provider
      value={{ tasks, logs, inventory, inventoryHistory, addTask, updateTask, addLog, updateInventory, consumeInventory, addInventoryItem }}
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
