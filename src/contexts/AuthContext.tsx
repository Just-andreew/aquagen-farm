import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, // <--- NEW
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // <--- ADD setDoc
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

type Role = 'admin' | 'supervisor' | 'farm_technician';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>; // <--- NEW
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: firebaseUser.uid,
              name: userData.name || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: userData.role || 'farm_technician' 
            });
          } else {
            setUser({
              id: firebaseUser.uid,
              name: firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'farm_technician'
            });
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error: any) {
      console.error("Login failed:", error);
      toast.error("Invalid email or password.");
      return false;
    }
  };

  // --- NEW SIGNUP FUNCTION ---
  const signup = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      // 1. Create the Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Create the Database profile (Forcing 'farm_technician' as default)
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email,
        role: 'farm_technician',
        created_at: new Date().toISOString()
      });
      
      return true;
    } catch (error: any) {
      console.error("Signup failed:", error);
      toast.error(error.message || "Failed to create account.");
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};