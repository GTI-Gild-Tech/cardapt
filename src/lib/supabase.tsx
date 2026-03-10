// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Estender a interface Window para incluir env
declare global {
  interface Window {
    env?: {
      REACT_APP_SUPABASE_URL?: string;
      REACT_APP_SUPABASE_ANON_KEY?: string;
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_ANON_KEY?: string;
    };
  }
}

// Verifica o ambiente e retorna a URL correta
const getSupabaseUrl = (): string => {
  // Para desenvolvimento com Create React App
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_URL) {
    return process.env.REACT_APP_SUPABASE_URL;
  }
  
  // Para Vite
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL;
  }
  
  // Para Netlify (variáveis injetadas no window)
  if (typeof window !== 'undefined' && window.env && window.env.REACT_APP_SUPABASE_URL) {
    return window.env.REACT_APP_SUPABASE_URL;
  }
  
  if (typeof window !== 'undefined' && window.env && window.env.VITE_SUPABASE_URL) {
    return window.env.VITE_SUPABASE_URL;
  }
  
  // Fallback (apenas para desenvolvimento)
  console.warn('Supabase URL não encontrada, usando fallback');
  return 'https://ukislbyyxudknpcedbbm.supabase.co';
};

const getSupabaseAnonKey = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_ANON_KEY) {
    return process.env.REACT_APP_SUPABASE_ANON_KEY;
  }
  
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY;
  }
  
  if (typeof window !== 'undefined' && window.env && window.env.REACT_APP_SUPABASE_ANON_KEY) {
    return window.env.REACT_APP_SUPABASE_ANON_KEY;
  }
  
  if (typeof window !== 'undefined' && window.env && window.env.VITE_SUPABASE_ANON_KEY) {
    return window.env.VITE_SUPABASE_ANON_KEY;
  }
  
  console.warn('Supabase Anon Key não encontrada, usando fallback');
  return 'sua-chave-anon-aqui';
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

console.log('Ambiente de execução:', {
  NODE_ENV: process.env.NODE_ENV,
  hasProcess: typeof process !== 'undefined',
  hasImportMeta: typeof import.meta !== 'undefined',
  hasWindowEnv: !!(typeof window !== 'undefined' && window.env)
});

console.log('Supabase config:', { 
  url: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'não definida',
  key: supabaseAnonKey ? 'definida' : 'não definida' 
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase-auth-token',
  }
});