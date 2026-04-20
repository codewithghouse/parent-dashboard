import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { syncClaimsAndRefreshToken } from './syncClaims';
import { isIOSStandalone } from './platform';

interface AuthContextType {
  user: User | null;
  studentData: any | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [studentData, setStudentData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track student listener so we can clean it up when auth changes
  const unsubStudentRef = useRef<(() => void) | null>(null);

  // Resolve any pending redirect sign-in (iOS standalone path) before we
  // attach the auth listener — otherwise the user can briefly flash to the
  // login screen after returning from the Google redirect.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          // onAuthStateChanged will fire next; nothing to do here.
          console.info('[Auth] Redirect sign-in resolved for', result.user.email);
        }
      })
      .catch((err) => {
        // Surface the error in the UI — silent failures here are why users
        // see the login screen "do nothing" after returning from Google.
        console.error('[Auth] getRedirectResult failed:', err?.code, err?.message || err);
        const code = err?.code as string | undefined;
        if (code === 'auth/unauthorized-domain') {
          setError('This domain is not authorized for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.');
        } else if (code === 'auth/network-request-failed') {
          setError('Network error during sign-in. Check your connection and try again.');
        } else if (code) {
          setError(`Sign-in failed (${code}). Please try again.`);
        }
      });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Always clean up previous student listener first
      if (unsubStudentRef.current) { unsubStudentRef.current(); unsubStudentRef.current = null; }
      setLoading(true);
      if (currentUser && currentUser.email) {
        try {
          // Sync custom claims first. The Cloud Function looks up the student
          // across schools (Admin SDK bypasses rules) and returns the chosen
          // schoolId. We then filter our client-side query by that schoolId so
          // Firestore rules accept it.
          const synced = await syncClaimsAndRefreshToken(currentUser);
          const claimSchoolId = synced?.schoolId || null;

          // Whitelist Check for Students/Parents — must filter by schoolId
          // so the list query passes the `inSameSchool()` rule.
          const lowerEmail = currentUser.email.toLowerCase();
          const q = claimSchoolId
            ? query(
                collection(db, "students"),
                where("schoolId", "==", claimSchoolId),
                where("email", "==", lowerEmail),
              )
            : query(collection(db, "students"), where("email", "==", lowerEmail));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const studentId = querySnapshot.docs[0].id;

            // Set up Real-Time Listener and store it for cleanup
            const unsubStudent = onSnapshot(doc(db, "students", studentId), async (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();

                // Block deactivated / suspended accounts
                if (data.status === "Deactivated" || data.status === "Suspended" || data.status === "Blocked") {
                   await signOut(auth);
                   setUser(null);
                   setStudentData(null);
                   setError("Your account has been deactivated. Please contact school administration.");
                   setLoading(false);
                   return;
                }

                if (data.status === "Invited") {
                   updateDoc(doc(db, "students", studentId), { status: "Active" });
                }

                // Fetch Class Name — use getDoc (single doc get) instead of
                // a list query so rules can resolve via the per-doc `get` rule.
                let className = "General";
                if (data.classId) {
                   const classDoc = await getDoc(doc(db, "classes", data.classId));
                   if (classDoc.exists()) className = (classDoc.data() as any).name || "General";
                }

                setStudentData({ id: studentId, ...data, className });
                setUser(currentUser);
                setError(null);
                setLoading(false);
              }
            });
            unsubStudentRef.current = unsubStudent;
          } else {
            // Not in whitelist
            await signOut(auth);
            setUser(null);
            setStudentData(null);
            setError("You are not authorized to access the Parent Dashboard. Please contact your school administration.");
            setLoading(false);
          }
        } catch (err: any) {
          console.error("Auth Error:", err);
          setError("An error occurred during verification.");
          setLoading(false);
        }
      } else {
        setUser(null);
        setStudentData(null);
        setLoading(false);
      }
      setLoading(false);
    });

    return () => { unsubscribe(); if (unsubStudentRef.current) { unsubStudentRef.current(); unsubStudentRef.current = null; } };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Force account chooser even when one Google account is already signed in
    // on the device — otherwise iOS auto-picks an account that may not be
    // whitelisted in our Firestore students collection.
    provider.setCustomParameters({ prompt: 'select_account' });

    setError(null);

    // STRATEGY:
    //   Popup-first on every platform (incl. iOS standalone — iOS 16.4+
    //   supports popups inside installed PWAs and avoids the ITP/redirect
    //   pitfalls that broke signInWithRedirect).
    //   Fall back to redirect ONLY if the popup is blocked / unsupported,
    //   which covers older iOS and stricter browsers.
    try {
      await signInWithPopup(auth, provider);
      return;
    } catch (err: any) {
      const code = err?.code as string | undefined;
      console.warn('[Auth] popup sign-in failed, code=', code, 'msg=', err?.message);

      // User explicitly cancelled — don't escalate, stay silent.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }

      // Popup couldn't even be opened (blocked, or the runtime doesn't
      // support popups). Fall back to redirect (which is the only option
      // on Android Chrome PWA + older iOS).
      const popupUnsupported =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        // iOS Safari sometimes throws this when the popup is killed mid-flow
        code === 'auth/web-storage-unsupported' ||
        // On iOS standalone, certain iOS versions throw this when the popup
        // child window can't communicate back to the opener.
        (isIOSStandalone() && code === 'auth/internal-error');

      if (popupUnsupported) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr: any) {
          console.error('[Auth] redirect fallback also failed:', redirectErr?.code, redirectErr?.message);
          setError(`Sign-in failed (${redirectErr?.code || 'unknown'}). Please try again.`);
          throw redirectErr;
        }
      }

      // Specific error codes → friendly messages
      if (code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized in Firebase Console → Authentication → Settings → Authorized domains.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(err?.message || `Sign-in failed (${code || 'unknown error'}).`);
      }
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem("parent_ai_persistent_cache_v3");
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, studentData, loading, loginWithGoogle, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};