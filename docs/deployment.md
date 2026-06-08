# 生产部署说明

目标：把项目部署到一台已有服务器和一个已有域名上，让用户可以通过手机或其它设备访问。

## 1. 推荐访问结构

```text
https://你的域名/              -> 前端 React 页面
https://你的域名/api/...       -> 后端 Gin API
wss://你的域名/ws/auctions/:id -> WebSocket
https://你的域名/uploads/...   -> 商品图片
```

前端生产构建默认使用当前域名访问 `/api` 和 `/ws`，无需把域名写死进前端代码。

## 2. 服务器前置条件

服务器建议：

- Linux x86_64
- Docker
- Docker Compose plugin
- 域名 A 记录已解析到服务器公网 IP
- 80 / 443 端口已在云厂商安全组和系统防火墙放行

检查命令：

```bash
docker --version
docker compose version
```

## 3. 上传代码

```bash
git clone https://github.com/wangxz01/auction-system-douyin.git
cd auction-system-douyin
```

如果服务器已经有仓库：

```bash
git pull origin main
```

## 4. 配置生产环境变量

```bash
cd deploy
cp .env.prod.example .env.prod
```

编辑 `.env.prod`：

```env
SERVER_MODE=release
DB_PASSWORD=强密码
MYSQL_ROOT_PASSWORD=强密码
JWT_SECRET=至少32位随机字符串
ALLOWED_ORIGINS=https://你的域名
ADMIN_USERNAMES=admin
```

必须替换：

- `JWT_SECRET`
- `DB_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `ALLOWED_ORIGINS`
- `ADMIN_USERNAMES`

## 5. 配置 Nginx 域名

编辑 `deploy/nginx.conf`，把所有 `YOUR_DOMAIN_HERE` 替换为你的真实域名。

```bash
sed -i 's/YOUR_DOMAIN_HERE/你的域名/g' nginx.conf
```

macOS 本地编辑时 `sed -i` 参数不同，建议直接用编辑器替换。

## 6. HTTPS 证书

推荐用 Certbot 生成证书。先准备目录：

```bash
mkdir -p certbot/www letsencrypt
```

临时启动 HTTP Nginx 或使用服务器已有 Nginx 完成 ACME 校验。证书生成后，目录结构应类似：

```text
deploy/letsencrypt/live/你的域名/fullchain.pem
deploy/letsencrypt/live/你的域名/privkey.pem
```

如果你已经在服务器系统 Nginx 上有证书，也可以改 `deploy/nginx.conf` 中的证书路径，挂载对应目录。

## 7. 启动服务

```bash
cd deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

查看状态：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
```

## 8. 初始化管理员账号

打开：

```text
https://你的域名/login
```

注册用户名为 `admin` 的账号。因为 `.env.prod` 里配置了：

```env
ADMIN_USERNAMES=admin
```

该账号登录后就是超级管理员。

## 9. 验证清单

浏览器或手机访问：

```text
https://你的域名/
https://你的域名/health
https://你的域名/admin
```

完整业务验证：

1. 手机打开首页。
2. 登录或注册用户。
3. 管理员发布竞拍商品。
4. 开始竞拍。
5. 两个设备同时进入直播间出价。
6. 检查 WebSocket 是否实时刷新。
7. 封顶或倒计时结束后检查订单。

## 10. 常见问题

### 前端打开后请求 localhost

原因：前端构建时 `VITE_API_BASE` 被写成了 `http://localhost:8080`。

解决：生产构建不要设置 `VITE_API_BASE`，或设置为 `https://你的域名`。

### WebSocket 连接失败

检查 Nginx `/ws/` 是否配置：

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

HTTPS 页面必须使用 `wss://`，不能使用 `ws://`。

### 后端启动失败

release 模式下必须配置：

```env
JWT_SECRET=...
ALLOWED_ORIGINS=https://你的域名
```

且 `ALLOWED_ORIGINS` 不能为 `*`。

### 图片上传后访问不到

确认 `uploads_data` volume 正常挂载到后端：

```yaml
backend:
  volumes:
    - uploads_data:/app/uploads
```

同时确认 Nginx 有 `/uploads/` 反向代理。

## 11. 还缺你的真实信息

我还需要你提供这些才能帮你做最终服务器部署：

1. 真实域名
2. 服务器系统和架构，例如 Ubuntu 22.04 x86_64
3. 是否已经安装 Docker
4. 证书方式：已有证书还是需要 Certbot 申请
5. 是否允许我根据你的域名直接替换 `deploy/nginx.conf` 和 `.env.prod`
