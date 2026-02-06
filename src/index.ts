import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono-alibaba-cloud-fc3-adapter'

const app = new Hono()

const API_TARGETS: Record<string, string> = {
  fundsuggest: 'https://fundsuggest.eastmoney.com',
  fundgz: 'https://fundgz.1234567.com.cn',
  fundf10: 'https://fundf10.eastmoney.com'
}

// CORS 中间件
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400
}))

// 专用接口: /api/fund/netvalue?code=xxx - 获取基金最新净值
app.get('/api/fund/netvalue', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.json({ error: 'Missing code parameter' }, 400)
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
    const dateMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td>/)
    const valueMatch = html.match(/<td>(\d{4}-\d{2}-\d{2})<\/td><td[^>]*>([^<]+)<\/td>/)
    const changeMatch = html.match(/<td[^>]*>(-?\d+\.?\d*)%<\/td>/)

    if (dateMatch && valueMatch) {
      return c.json({
        netValue: parseFloat(valueMatch[2]) || 0,
        netValueDate: dateMatch[1],
        change: changeMatch ? parseFloat(changeMatch[1]) : 0
      })
    }

    return c.json({ error: 'Failed to parse data', raw: html }, 500)
  } catch (error) {
    return c.json({ error: 'Request failed' }, 500)
  }
})

// 通用代理路由: /api/{target}/{path}
app.all('/api/:target/*', async (c) => {
  const target = c.req.param('target')
  const baseUrl = API_TARGETS[target]

  if (!baseUrl) {
    return c.json({ error: 'Unknown target' }, 400)
  }

  // 获取剩余路径
  const fullPath = c.req.path
  const path = fullPath.replace(`/api/${target}`, '')
  const search = new URL(c.req.url).search

  const targetUrl = `${baseUrl}${path}${search}`
  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': baseUrl
    }
  })

  const body = await response.text()
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'text/plain'
    }
  })
})

// 根路径健康检查
app.get('/', (c) => c.json({ status: 'ok', service: 'fund-eye-server' }))

// 阿里云函数计算入口
export const handler = handle(app)
