import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Paste the config object from Firebase Console → Project settings → General → Your apps → SDK setup
// (see README.md for the exact steps)
const firebaseConfig = {
  apiKey: 'AIzaSyBbfv6oAwInVRY0u78_p-h1N36RO11l9so',
  authDomain: 'bac-tracker-c01c7.firebaseapp.com',
  projectId: 'bac-tracker-c01c7',
  storageBucket: 'bac-tracker-c01c7.firebasestorage.app',
  messagingSenderId: '148533222114',
  appId: '1:148533222114:web:476c8e7802027aebae9cbb',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Lets the app keep working (read-only, from cache) if the phone briefly loses signal.
try {
  enableIndexedDbPersistence(db);
} catch (e) {
  /* fails silently in unsupported browsers or multiple open tabs — safe to ignore */
}
