/**
 * Cross-subdomain session management with chunked cookie support
 * 
 * Handles:
 * - Small sessions (< 3800 bytes): Single bunting-auth-token cookie
 * - Large sessions (> 3800 bytes): Split into bunting-auth-token.0, .1, etc. + .count
 */

const COOKIE_NAME = 'bunting-auth-token';
const MAX_COOKIE_SIZE = 3800; // Leave room for cookie attributes
const COOKIE_DOMAIN = '.buntinggpt.com';
const COOKIE_MAX_AGE = 31536000; // 1 year

interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
}

function isProduction(): boolean {
  return typeof window !== 'undefined' && 
    window.location.hostname.endsWith('.buntinggpt.com');
}

function getCookieOptions(): CookieOptions {
  const isProd = isProduction();
  return {
    path: '/',
    domain: isProd ? COOKIE_DOMAIN : undefined,
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'Lax',
    secure: isProd,
  };
}

function buildCookieString(name: string, value: string, options: CookieOptions): string {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
  if (options.path) cookie += `; path=${options.path}`;
  if (options.domain) cookie += `; domain=${options.domain}`;
  if (options.maxAge !== undefined) cookie += `; max-age=${options.maxAge}`;
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options.secure) cookie += `; Secure`;
  
  return cookie;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, ...cookieValueParts] = cookie.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValueParts.join('='));
    }
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = buildCookieString(name, value, getCookieOptions());
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const options = getCookieOptions();
  options.maxAge = 0;
  document.cookie = buildCookieString(name, '', options);
}

/**
 * Read session from cookies (handles both chunked and single cookie)
 */
export function readSession<T = unknown>(): T | null {
  try {
    // Check for chunked session first
    const countStr = getCookie(`${COOKIE_NAME}.count`);
    
    if (countStr) {
      const count = parseInt(countStr, 10);
      if (isNaN(count) || count <= 0) {
        console.warn('[CookieSession] Invalid chunk count:', countStr);
        return null;
      }
      
      // Reassemble chunks
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = getCookie(`${COOKIE_NAME}.${i}`);
        if (chunk === null) {
          console.warn(`[CookieSession] Missing chunk ${i} of ${count}`);
          return null;
        }
        chunks.push(chunk);
      }
      
      const sessionData = chunks.join('');
      console.log(`[CookieSession] Reassembled ${count} chunks (${sessionData.length} bytes)`);
      return JSON.parse(sessionData);
    }
    
    // Single cookie
    const singleCookie = getCookie(COOKIE_NAME);
    if (singleCookie) {
      console.log(`[CookieSession] Read single cookie (${singleCookie.length} bytes)`);
      return JSON.parse(singleCookie);
    }
    
    return null;
  } catch (error) {
    console.error('[CookieSession] Error reading session:', error);
    return null;
  }
}

/**
 * Write session to cookies (automatically chunks if needed)
 */
export function writeSession<T>(data: T): void {
  try {
    const sessionStr = JSON.stringify(data);
    
    // Clear any existing session first
    clearSession();
    
    if (sessionStr.length <= MAX_COOKIE_SIZE) {
      // Single cookie
      setCookie(COOKIE_NAME, sessionStr);
      console.log(`[CookieSession] Wrote single cookie (${sessionStr.length} bytes)`);
    } else {
      // Chunk the session
      const chunks: string[] = [];
      for (let i = 0; i < sessionStr.length; i += MAX_COOKIE_SIZE) {
        chunks.push(sessionStr.slice(i, i + MAX_COOKIE_SIZE));
      }
      
      // Write chunks
      for (let i = 0; i < chunks.length; i++) {
        setCookie(`${COOKIE_NAME}.${i}`, chunks[i]);
      }
      
      // Write count
      setCookie(`${COOKIE_NAME}.count`, chunks.length.toString());
      
      console.log(`[CookieSession] Wrote ${chunks.length} chunks (${sessionStr.length} bytes total)`);
    }
  } catch (error) {
    console.error('[CookieSession] Error writing session:', error);
  }
}

/**
 * Clear all session cookies
 */
export function clearSession(): void {
  try {
    // Delete single cookie
    deleteCookie(COOKIE_NAME);
    
    // Delete chunks (check for count first)
    const countStr = getCookie(`${COOKIE_NAME}.count`);
    if (countStr) {
      const count = parseInt(countStr, 10);
      if (!isNaN(count)) {
        for (let i = 0; i < count; i++) {
          deleteCookie(`${COOKIE_NAME}.${i}`);
        }
      }
    }
    
    // Delete count
    deleteCookie(`${COOKIE_NAME}.count`);
    
    // Also try to delete any orphaned chunks (up to 10)
    for (let i = 0; i < 10; i++) {
      deleteCookie(`${COOKIE_NAME}.${i}`);
    }
    
    console.log('[CookieSession] Cleared all session cookies');
  } catch (error) {
    console.error('[CookieSession] Error clearing session:', error);
  }
}

/**
 * Check if a session exists
 */
export function hasSession(): boolean {
  return getCookie(COOKIE_NAME) !== null || getCookie(`${COOKIE_NAME}.count`) !== null;
}
