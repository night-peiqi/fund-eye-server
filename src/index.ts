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

    // 专用接口: /api/fund/netvalue?code=xxx - 获取基金最新净值
    if (url.pathname === '/api/fund/netvalue') {
      return handleNetValue(url, origin, env)
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

/**
 * 获取基金最新净值（用于收盘后更新）
 * 解析东方财富历史净值接口返回的 HTML 表格
 */
async function handleNetValue(url: URL, origin: string, env: Env): Promise<Response> {
  const code = url.searchParams.get('code')
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
    })
  }

  try {
    const apiUrl = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=1`
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://fund.eastmoney.com/f10/jjjz_${code}.html`
      }
    })

    const html = await response.text()
    
    // 解析 HTML 表格
    // 格式: <td>2026-02-04</td><td>1.2345</td><td>1.2345</td><td class="...">0.50%</td>
    const dateMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td>/)
    const valueMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td><td[^>]*>([^<]+)<\/td>/)
    const changeMatch = html.match(/<td[^>]*>(-?\d+\.?\d*)%<\/td>/)

    if (dateMatch && valueMatch) {
      return new Response(JSON.stringify({
        netValue: parseFloat(valueMatch[2]) || 0,
        netValueDate: dateMatch[1],
        change: changeMatch ? parseFloat(changeMatch[1]) : 0
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
      })
    }

    return new Response(JSON.stringify({ error: 'Failed to parse data', raw: html }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) }
    })
  }
}
