export interface Env {
  ALLOWED_ORIGIN: string
}

const API_TARGETS: Record<string, string> = {
  fundsuggest: 'https://fundsuggest.eastmoney.com',
  fundgz: 'https://fundgz.1234567.com.cn',
  fundf10: 'https://fundf10.eastmoney.com'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''
    
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, env) })
    }

    // 路由: /api/{target}/{path}
    const match = url.pathname.match(/^\/api\/(\w+)(\/.*)$/)
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
      })
    }

    const [, target, path] = match
    const baseUrl = API_TARGETS[target]
    if (!baseUrl) {
      return new Response(JSON.stringify({ error: 'Unknown target' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
      })
    }

    // 代理请求
    const targetUrl = `${baseUrl}${path}${url.search}`
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': baseUrl
      }
    })

    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        ...corsHeaders(origin, env)
      }
    })
  }
}

function corsHeaders(origin: string, env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }
}
