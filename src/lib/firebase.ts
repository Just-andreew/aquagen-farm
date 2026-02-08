import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore"; //
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// PASTE YOUR CONFIG HERE FROM THE FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyA_Ruq3C5qEaK_7hOqNxpf4WjByv7gM_yc",
  authDomain: "aquagen-farm.firebaseapp.com",
  projectId: "aquagen-farm",
  storageBucket: "aquagen-farm.firebasestorage.app",
  messagingSenderId: "516222377778",
  appId: "1:516222377778:web:015bbcd2733eb4eb7f012b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ⚡ ENABLE OFFLINE PERSISTENCE ⚡
// We use 'initializeFirestore' instead of 'getFirestore' to configure the cache settings.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() 
  })
});

// Export the database instance so other files can use it
export const auth = getAuth(app);
export const storage = getStorage(app);