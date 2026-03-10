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
        console.log('AuthProvider - verificando sessão...');
        console.log('AuthProvider - URL atual:', window.location.origin);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("AuthProvider - erro ao verificar sessão:", error);
        }
        
        console.log('AuthProvider - sessão encontrada:', session?.user?.email ?? 'nenhuma');
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
      } catch (error) {
        console.error("AuthProvider - exceção ao verificar sessão:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthProvider - evento de autenticação:', event);
      console.log('AuthProvider - usuário:', session?.user?.email ?? 'deslogado');
      
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
      console.log('AuthProvider - URL de redirecionamento:', window.location.origin);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (error) {
        console.error("AuthProvider - erro no login:", error.message);
        return false;
      }

      if (data.user) {
        console.log('AuthProvider - login bem-sucedido:', data.user.email);
        console.log('AuthProvider - sessão:', data.session ? 'criada' : 'falhou');
        
        setUser(data.user);
        setIsAuthenticated(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("AuthProvider - exceção no login:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      console.log('AuthProvider - fazendo logout');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("AuthProvider - erro no logout:", error);
      } else {
        console.log('AuthProvider - logout bem-sucedido');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("AuthProvider - exceção no logout:", error);
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