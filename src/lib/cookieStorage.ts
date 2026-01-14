// Cookie-based storage adapter for Supabase auth
// Enables cross-subdomain session sharing on .buntinggpt.com

const COOKIE_DOMAIN = '.buntinggpt.com';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let cookieString = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  if (!isLocalhost) cookieString += `; domain=${COOKIE_DOMAIN}`;
  if (window.location.protocol === 'https:') cookieString += '; Secure';
  document.cookie = cookieString;
}

function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let cookieString = `${name}=; path=/; max-age=0; SameSite=Lax`;
  if (!isLocalhost) cookieString += `; domain=${COOKIE_DOMAIN}`;
  document.cookie = cookieString;
}

export const cookieStorage = {
  getItem: (key: string): string | null => getCookie(key),
  setItem: (key: string, value: string): void => setCookie(key, value),
  removeItem: (key: string): void => removeCookie(key),
};

export default cookieStorage;
