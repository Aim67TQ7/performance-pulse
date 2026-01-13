// Cross-subdomain SSO via shared cookies
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://qzwxisdfwswsrbzvpzlo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6d3hpc2Rmd3N3c3JienZwemxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTg2NjYsImV4cCI6MjA1NDE3NDY2Nn0.nVV1d-_BfhfVNOSiusg8zSuvPwS4dSB-cJAMGVjujr4";

// Check if we're on a buntinggpt.com subdomain
const isBuntingDomain = typeof window !== 'undefined' && 
  window.location.hostname.endsWith('.buntinggpt.com');

// Cookie configuration
const COOKIE_OPTIONS = {
  domain: '.buntinggpt.com',
  path: '/',
  sameSite: 'Lax' as const,
  secure: true,
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

const CHUNK_SIZE = 3000; // Safe size under 4KB limit

// Chunked cookie storage for cross-subdomain SSO
const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split('; ');
    const chunks: string[] = [];
    
    // First, try to get a single cookie (non-chunked)
    const singleCookie = cookies.find(c => c.startsWith(`${key}=`));
    if (singleCookie) {
      const value = singleCookie.split('=').slice(1).join('=');
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    
    // Otherwise, look for chunks
    let i = 0;
    while (true) {
      const chunkKey = `${key}.${i}`;
      const chunk = cookies.find(c => c.startsWith(`${chunkKey}=`));
      if (!chunk) break;
      const value = chunk.split('=').slice(1).join('=');
      try {
        chunks.push(decodeURIComponent(value));
      } catch {
        chunks.push(value);
      }
      i++;
    }
    
    return chunks.length > 0 ? chunks.join('') : null;
  },
  
  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    
    // Clear existing cookies (both single and chunked)
    cookieStorage.removeItem(key);
    
    const encoded = encodeURIComponent(value);
    const { domain, path, sameSite, secure, maxAge } = COOKIE_OPTIONS;
    const cookieBase = `; Domain=${domain}; Path=${path}; SameSite=${sameSite}; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
    
    // If small enough, store as single cookie
    if (encoded.length <= CHUNK_SIZE) {
      document.cookie = `${key}=${encoded}${cookieBase}`;
      return;
    }
    
    // Otherwise, chunk it
    const chunks = [];
    for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
      chunks.push(encoded.slice(i, i + CHUNK_SIZE));
    }
    
    chunks.forEach((chunk, i) => {
      document.cookie = `${key}.${i}=${chunk}${cookieBase}`;
    });
  },
  
  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    
    const { domain, path } = COOKIE_OPTIONS;
    const expireBase = `; Domain=${domain}; Path=${path}; Max-Age=0`;
    
    // Remove single cookie
    document.cookie = `${key}=${expireBase}`;
    
    // Remove all chunks
    for (let i = 0; i < 10; i++) {
      document.cookie = `${key}.${i}=${expireBase}`;
    }
  },
};

// Use cookies for buntinggpt.com, localStorage for localhost
const storage = isBuntingDomain ? cookieStorage : 
  (typeof window !== 'undefined' ? window.localStorage : undefined);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});
