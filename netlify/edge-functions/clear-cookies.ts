export default async (request: Request) => {
  const url = new URL(request.url);
  
  // Skip if already cleared this session
  if (url.searchParams.get('_c') === '1') {
    return;
  }
  
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><title>Loading...</title></head>
    <body>
      <script>
        const cookies = document.cookie.split(';');
        cookies.forEach(c => {
          const name = c.split('=')[0].trim();
          if (name) {
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=.buntinggpt.com; path=/';
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          }
        });
        const url = new URL(window.location.href);
        url.searchParams.set('_c', '1');
        window.location.href = url.toString();
      </script>
    </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } });
};

export const config = { path: '/*' };
