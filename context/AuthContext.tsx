import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { AdminUser } from '../types';
import { 
  AuthStatus, 
  AuthState, 
  loginWithEmail, 
  logoutUser, 
  subscribeToAuth 
} from '../services/authService';

export interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  adminData: AdminUser | null;
  status: AuthStatus;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    adminData: null,
    status: 'loading',
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuth((updatedState) => {
      setAuthState(updatedState);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await loginWithEmail(email, password);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: authState.user,
        isAdmin: authState.isAdmin,
        adminData: authState.adminData,
        status: authState.status,
        loading: authState.loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
