import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono-alibaba-cloud-fc3-adapter'

const app = new Hono()

const API_TARGETS: Record<string, string> = {
  fundsuggest: 'https://fundsuggest.eastmoney.com',
  fundgz: 'https://fundgz.1234567.com.cn',
  fundf10: 'https://fundf10.eastmoney.com'
}

// 股票行情类型
interface StockQuote {
  code: string
  name: string
  price: number
  change: number
  changeAmount: number
}

// 东方财富 API 响应类型
interface QuoteResponse {
  data?: {
    diff?: {
      f2?: number   // 最新价
      f3?: number   // 涨跌幅
      f4?: number   // 涨跌额
      f12?: string  // 代码
      f14?: string  // 名称
    }[]
  }
}

// 转换股票代码为东方财富 secid 格式
function formatSecId(code: string): string {
  const cleanCode = code.replace(/[^\d]/g, '')
  if (cleanCode.startsWith('6')) {
    return `1.${cleanCode}` // 上海
  } else if (cleanCode.startsWith('0') || cleanCode.startsWith('3')) {
    return `0.${cleanCode}` // 深圳
  } else if (cleanCode.startsWith('4') || cleanCode.startsWith('8')) {
    return `0.${cleanCode}` // 北交所
  }
  return `0.${cleanCode}`
}

// 批量获取股票行情
async function getStockQuotes(codes: string[]): Promise<StockQuote[]> {
  if (codes.length === 0) return []
  
  const secids = codes.map(formatSecId).join(',')
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f12,f14&secids=${secids}&_=${Date.now()}`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://quote.eastmoney.com/'
    }
  })
  
  const data: QuoteResponse = await response.json()
  const quotes: StockQuote[] = []
  
  if (data.data?.diff) {
    for (const item of data.data.diff) {
      quotes.push({
        code: item.f12 || '',
        name: item.f14 || '',
        price: typeof item.f2 === 'number' ? item.f2 : 0,
        change: typeof item.f3 === 'number' ? item.f3 : 0,
        changeAmount: typeof item.f4 === 'number' ? item.f4 : 0
      })
    }
  }
  
  return quotes
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

// 股票行情接口: /api/stock/quotes?codes=600519,000858
app.get('/api/stock/quotes', async (c) => {
  const codesParam = c.req.query('codes')
  if (!codesParam) {
    return c.json({ error: 'Missing codes parameter' }, 400)
  }
  
  const codes = codesParam.split(',').map(s => s.trim()).filter(Boolean)
  if (codes.length === 0) {
    return c.json({ error: 'No valid codes provided' }, 400)
  }
  
  try {
    const quotes = await getStockQuotes(codes)
    return c.json({ data: quotes })
  } catch (error) {
    console.error('Failed to fetch stock quotes:', error)
    return c.json({ error: 'Request failed' }, 500)
  }
})

// 通用代理路由: /api/{target}/{path} (放在具体路由之后)
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
