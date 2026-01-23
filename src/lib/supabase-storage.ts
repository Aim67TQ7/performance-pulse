/**
 * BuntingGPT Cross-Subdomain Auth Storage
 * 
 * CRITICAL: All *.buntinggpt.com apps MUST use this exact implementation.
 * 
 * Features:
 * - Chunked cookie storage for large OAuth tokens
 * - Automatic cleanup of stale/invalid cookies
 * - Cross-subdomain sharing via .buntinggpt.com
 * 
 * Storage key: bunting-auth-token (DO NOT CHANGE)
 */

const STORAGE_KEY = 'bunting-auth-token';
const CHUNK_SIZE = 3800;
const COOKIE_DOMAIN = '.buntinggpt.com';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ============================================
// Cookie Utilities
// ============================================

function getCookieConfig(): { domain: string; secure: string } {
  if (typeof window === 'undefined') {
    return { domain: '', secure: '' };
  }
  const hostname = window.location.hostname;
  const isProduction = hostname.endsWith('buntinggpt.com');
  const isSecure = window.location.protocol === 'https:';
  return {
    domain: isProduction ? ` domain=${COOKIE_DOMAIN};` : '',
    secure: isSecure ? ' Secure;' : ''
  };
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.trim().split('=');
    if (cookieName === name) {
      try {
        return decodeURIComponent(valueParts.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const config = getCookieConfig();
  const encoded = encodeURIComponent(value);
  document.cookie = `${name}=${encoded}; path=/;${config.domain}${config.secure} SameSite=Lax; max-age=${MAX_AGE_SECONDS}`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const config = getCookieConfig();
  // Delete with domain
  document.cookie = `${name}=; path=/;${config.domain} expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  // Also delete without domain (cleans up any local-scoped cookies)
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ============================================
// Stale Cookie Cleanup
// ============================================

/**
 * Purges ALL auth-related cookies from the browser.
 * Call this when:
 * - Token validation fails
 * - Token is expired or malformed
 * - User explicitly logs out
 * - Auth state is inconsistent
 */
export function purgeAllAuthCookies(): void {
  if (typeof document === 'undefined') return;
  
  console.log('[BuntingAuth] Purging all auth cookies...');
  
  // 1. Clear chunked bunting-auth-token cookies
  const countCookie = getCookie(`${STORAGE_KEY}.count`);
  if (countCookie) {
    const count = parseInt(countCookie, 10);
    for (let i = 0; i < count; i++) {
      deleteCookie(`${STORAGE_KEY}.${i}`);
    }
    deleteCookie(`${STORAGE_KEY}.count`);
  }
  
  // 2. Clear any non-chunked bunting-auth-token
  deleteCookie(STORAGE_KEY);
  
  // 3. Clear legacy Supabase cookies (sb-* pattern)
  const allCookies = document.cookie.split(';');
  for (const cookie of allCookies) {
    const name = cookie.trim().split('=')[0];
    if (name.startsWith('sb-') || name.includes('supabase')) {
      deleteCookie(name);
    }
  }
  
  // 4. Clear localStorage Supabase keys (belt and suspenders)
  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase') || key === STORAGE_KEY)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  console.log('[BuntingAuth] Cookie purge complete');
}

/**
 * Validates the current auth token structure.
 * Returns false if token is missing, malformed, or expired.
 */
export function validateAuthToken(): boolean {
  const token = cookieStorage.getItem(STORAGE_KEY);
  
  if (!token) {
    return false;
  }
  
  try {
    const parsed = JSON.parse(token);
    
    // Check required fields (access_token from gate OAuth)
    if (!parsed.access_token) {
      console.log('[BuntingAuth] Token missing access_token');
      return false;
    }
    
    // Check expiration
    if (parsed.expires_at) {
      const expiresAt = new Date(parsed.expires_at * 1000);
      if (expiresAt < new Date()) {
        console.log('[BuntingAuth] Token expired');
        return false;
      }
    }
    
    return true;
  } catch (e) {
    console.log('[BuntingAuth] Token parse error:', e);
    return false;
  }
}

/**
 * Call this on app initialization to ensure clean auth state.
 * Returns true if valid session exists, false if cookies were purged.
 */
export function ensureCleanAuthState(): boolean {
  if (validateAuthToken()) {
    return true;
  }
  
  // Invalid or missing token - purge everything
  purgeAllAuthCookies();
  return false;
}

// ============================================
// Chunked Cookie Storage
// ============================================

export const cookieStorage = {
  getItem: (key: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    // Check for chunked storage
    const countStr = getCookie(`${key}.count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) {
        console.log('[BuntingAuth] Invalid chunk count, purging');
        purgeAllAuthCookies();
        return null;
      }
      
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = getCookie(`${key}.${i}`);
        if (chunk === null) {
          console.log(`[BuntingAuth] Missing chunk ${i}, purging`);
          purgeAllAuthCookies();
          return null;
        }
        chunks.push(chunk);
      }
      return chunks.join('');
    }
    
    // Fallback to single cookie
    return getCookie(key);
  },

  setItem: (key: string, value: string): void => {
    if (typeof document === 'undefined') return;
    
    // Clear any existing chunks first
    const existingCount = getCookie(`${key}.count`);
    if (existingCount) {
      const count = parseInt(existingCount, 10);
      for (let i = 0; i < count; i++) {
        deleteCookie(`${key}.${i}`);
      }
      deleteCookie(`${key}.count`);
    }
    deleteCookie(key);
    
    // Determine if chunking is needed
    const encoded = encodeURIComponent(value);
    if (encoded.length <= CHUNK_SIZE) {
      setCookie(key, value);
      return;
    }
    
    // Split into chunks
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    
    // Store chunks
    setCookie(`${key}.count`, chunks.length.toString());
    chunks.forEach((chunk, i) => {
      setCookie(`${key}.${i}`, chunk);
    });
  },

  removeItem: (key: string): void => {
    if (typeof document === 'undefined') return;
    
    // Remove chunks
    const countStr = getCookie(`${key}.count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        deleteCookie(`${key}.${i}`);
      }
      deleteCookie(`${key}.count`);
    }
    
    // Remove single cookie
    deleteCookie(key);
  }
};

// ============================================
// Legacy Compatibility Exports
// ============================================

// These match the old cookieSession.ts API for backward compatibility
export function readSession<T = unknown>(): T | null {
  const data = cookieStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export function writeSession<T>(data: T): void {
  cookieStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearSession(): void {
  purgeAllAuthCookies();
}

export function hasSession(): boolean {
  return validateAuthToken();
}
