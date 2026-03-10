// context/AuthContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('AuthProvider - sessão encontrada:', session?.user?.email);
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthProvider - mudança de estado:', _event, session?.user?.email);
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      console.log('AuthProvider - tentando login com:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("Erro no login:", error.message);
        return false;
      }

      if (data.user) {
        console.log('AuthProvider - login bem-sucedido:', data.user.email);
        setUser(data.user);
        setIsAuthenticated(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Erro no login:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Erro no logout:", error);
    } finally {
      setLoading(false);
    }
  };

  const value = { 
    isAuthenticated, 
    user,
    loading,
    login, 
    logout 
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};