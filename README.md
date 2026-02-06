# Fund Eye Server

基金数据代理服务，部署在阿里云函数计算。

## 服务地址

```
https://fund-eye-server-omrinldkwt.cn-beijing.fcapp.run
```

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置阿里云凭证

```bash
npx s config add
# 选择 Alibaba Cloud (alibaba)
# 输入 AccessKeyID 和 AccessKeySecret
```

AccessKey 获取地址：https://ram.console.aliyun.com/manage/ak

### 3. 部署

```bash
npm run deploy
```

部署成功后会返回函数的 HTTP 触发器地址。

## API 接口

### 获取基金净值
```
GET /api/fund/netvalue?code=000001
```

### 代理请求
```
GET /api/fundsuggest/{path}
GET /api/fundgz/{path}
GET /api/fundf10/{path}
```

## 修改区域

编辑 `s.yaml` 中的 `region` 字段，可选值：
- cn-hangzhou（杭州）
- cn-shanghai（上海）
- cn-beijing（北京）
- cn-shenzhen（深圳）
