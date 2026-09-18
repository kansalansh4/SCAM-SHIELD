import React, { createContext, useContext, useEffect, useState } from "react";
import { onIdTokenChanged, signOut } from "firebase/auth";
import { auth, authReady, call } from "../services/firebase.js";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(!auth),
    [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!auth) return;
    let unsub,
      live = true,
      lastUid;
    authReady
      .then(() => {
        if (!live) return;
        unsub = onIdTokenChanged(auth, (next) => {
          if (next?.uid !== lastUid) {
            lastUid = next?.uid;
            setEpoch((n) => n + 1);
          }
          setUser(
            next
              ? {
                  uid: next.uid,
                  email: next.email,
                  emailVerified: next.emailVerified,
                }
              : null,
          );
          setReady(true);
        });
      })
      .catch(() => setReady(true));
    return () => {
      live = false;
      unsub?.();
    };
  }, []);
  const clearSession = () => setEpoch((n) => n + 1);
  const logout = async () => {
    clearSession();
    await signOut(auth);
  };
  const refresh = async () => {
    await auth.currentUser?.reload();
    await auth.currentUser?.getIdToken(true);
    const u = auth.currentUser;
    setUser(
      u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified } : null,
    );
    if (u?.emailVerified) await call("ensureProfile", {});
  };
  return (
    <Context.Provider
      value={{ user, ready, epoch, logout, refresh, clearSession }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
