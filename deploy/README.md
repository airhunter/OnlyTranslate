# 只译官网部署

官网使用 Docker 构建，并由 Caddy 提供静态文件服务。生产环境默认域名为
`onlytranslate.top`。Caddy 会自动申请和续期 HTTPS 证书，并把 HTTP 请求跳转到
HTTPS。

## 服务器要求

- Rocky Linux 9
- 域名的 A 记录已经指向服务器公网 IPv4
- 腾讯云轻量应用服务器防火墙已放行 TCP 80、443
- 使用中国大陆服务器时，域名已完成 ICP 备案

## 安装 Docker

使用 Docker 官方 RHEL 软件源：

```bash
dnf -y install dnf-plugins-core
dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
docker version
docker compose version
```

## 开放系统防火墙

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
firewall-cmd --list-services
```

## 获取代码

服务器只保留一份 Git 工作副本。首次部署：

```bash
dnf -y install git
git clone https://github.com/airhunter/OnlyTranslate.git /opt/onlytranslate
cd /opt/onlytranslate
```

不要直接修改服务器上的仓库文件；官网内容和部署配置都应先在开发环境提交并推送
到 GitHub。

## 首次启动

在项目根目录运行：

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 website
```

证书和 Caddy 状态保存在 `caddy_data`、`caddy_config` 命名卷中，重建容器不会
删除这些数据。

## 更新网站

开发环境完成修改、验证并推送 GitHub 后，在服务器运行：

```bash
cd /opt/onlytranslate
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 website
```

`docker compose up -d --build` 会在 Docker 构建阶段执行 `pnpm site:build`，
然后使用新的静态文件镜像替换旧容器。

需要同时更新 Node 和 Caddy 基础镜像时运行：

```bash
docker compose build --pull website
docker compose up -d
```

## 上线检查

```bash
curl -I http://onlytranslate.top
curl -I https://onlytranslate.top
docker compose ps
docker compose logs --tail=100 website
```

预期 HTTP 返回重定向，HTTPS 返回成功状态。首页、使用帮助、隐私说明和三段演示
视频都应能正常打开与播放。

如果域名尚未生效，可先用服务器 IP 测试 HTTP。创建项目根目录 `.env`：

```dotenv
SITE_ADDRESS=http://服务器公网IP
```

测试完成并且域名解析生效后，把该文件改为：

```dotenv
SITE_ADDRESS=onlytranslate.top
```

再运行 `docker compose up -d`，Caddy 会开始申请正式证书。
