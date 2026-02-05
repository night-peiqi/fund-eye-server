# Fund Eye Server

基金数据代理服务，部署在 Cloudflare Workers。

## 开发

```bash
npm install
npm run dev
```

## 部署

```bash
npm run deploy
```

## API

- `GET /api/fundsuggest/*` - 代理基金搜索接口
- `GET /api/fundgz/*` - 代理基金估值接口  
- `GET /api/fundf10/*` - 代理基金持仓接口
