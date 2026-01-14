export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const url = new URL(request.url);
  
  // Only intercept top-level HTML navigation requests
  const isNavigationRequest = 
    request.headers.get('sec-fetch-mode') === 'navigate' ||
    (request.headers.get('accept')?.includes('text/html') && 
     request.method === 'GET' &&
     !url.pathname.startsWith('/assets/') &&
     !url.pathname.startsWith('/favicon') &&
     !url.pathname.endsWith('.js') &&
     !url.pathname.endsWith('.css') &&
     !url.pathname.endsWith('.png') &&
     !url.pathname.endsWith('.svg') &&
     !url.pathname.endsWith('.ico') &&
     url.pathname !== '/robots.txt');
  
  // Pass through non-navigation requests (assets, API calls, etc.)
  if (!isNavigationRequest) {
    return context.next();
  }
  
  // Skip cookie clearing if already done this session
  if (url.searchParams.get('_c') === '1') {
    return context.next();
  }
  
  // Check for 24-hour freshness cookie
  const cookies = request.headers.get('cookie') || '';
  const authIssuedMatch = cookies.match(/bunting_auth_issued_at=(\d+)/);
  
  if (authIssuedMatch) {
    const issuedAt = parseInt(authIssuedMatch[1], 10);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // If cookie is fresh (< 24 hours), pass through to app
    if (now - issuedAt < twentyFourHours) {
      return context.next();
    }
    
    // Cookie is stale (> 24 hours), redirect to login
    const returnUrl = encodeURIComponent(url.href);
    return Response.redirect(`https://login.buntinggpt.com?return_url=${returnUrl}`, 302);
  }
  
  // No freshness cookie exists - check if there are any auth cookies to clear
  const hasAuthCookies = cookies.includes('sb-') || cookies.includes('supabase');
  
  if (hasAuthCookies) {
    // Clear stale auth cookies and redirect to login
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>Redirecting...</title></head>
      <body>
        <script>
          // Clear only auth-related cookies
          const cookies = document.cookie.split(';');
          cookies.forEach(c => {
            const name = c.split('=')[0].trim();
            if (name && (name.startsWith('sb-') || name.includes('supabase') || name === 'bunting_auth_issued_at')) {
              document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.buntinggpt.com; path=/';
              document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
            }
          });
          // Redirect to login hub
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = 'https://login.buntinggpt.com?return_url=' + returnUrl;
        </script>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
  
  // No auth cookies at all - redirect to login
  const returnUrl = encodeURIComponent(url.href);
  return Response.redirect(`https://login.buntinggpt.com?return_url=${returnUrl}`, 302);
};

export const config = { path: '/*' };
