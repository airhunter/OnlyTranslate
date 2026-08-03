# 只译官网部署

官网使用 Docker 构建，并由 Caddy 提供静态文件服务。生产环境默认域名为
`onlytranslate.top`。Caddy 会自动申请和续期 HTTPS 证书，并把 HTTP 请求跳转到
HTTPS。`www.onlytranslate.top` 作为兼容入口，永久跳转到不带 `www` 的正式域名，
并保留访问路径和查询参数。

## 服务器要求

- Rocky Linux 9
- 域名的 A 记录已经指向服务器公网 IPv4
- `www` 的 CNAME 记录已经指向 `onlytranslate.top`
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

## 配置卸载反馈报表密码

卸载反馈报表使用 Caddy Basic Auth 保护。首次启动新版网站前，先生成密码哈希：

```bash
docker run --rm -it caddy:2-alpine caddy hash-password --algorithm argon2id
```

命令会提示输入密码且不会回显，并输出以 `$argon2id$` 开头的哈希。把原始密码保存
到密码管理器，然后在项目根目录创建或编辑 `.env`：

```dotenv
SITE_ADDRESS=onlytranslate.top
REPORT_USERNAME=admin
REPORT_PASSWORD_HASH='把上一条命令输出的完整哈希粘贴到这里'
```

哈希包含多个 `$`，必须使用单引号包裹，避免 Docker Compose 把它当成变量展开。
`.env` 已被 Git 忽略，不要提交到仓库。Caddy 不保存明文密码；忘记密码时重新生成
哈希并替换即可。

## 首次启动

在项目根目录运行：

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 website
```

证书和 Caddy 状态保存在 `caddy_data`、`caddy_config` 命名卷中，匿名卸载反馈
日志保存在 `uninstall_feedback` 命名卷中，重建容器不会删除这些数据。不要使用
`docker compose down -v`，否则这些命名卷会被删除。

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

## 查看卸载反馈

扩展卸载后会按界面语言打开官网问卷。用户自愿提交后，Caddy 只把感谢页请求写入
专用 JSON 日志；配置会删除 IP、请求头和其他无关请求元数据。日志每天滚动，最长
保留 90 天。

浏览器访问以下地址并输入 `.env` 中配置的用户名以及生成哈希时使用的原始密码：

```text
https://onlytranslate.top/internal/uninstall-report/
```

报表在浏览器中读取受保护的日志文件并完成汇总，可以切换最近 7 天、30 天、90 天，
也可以导出 CSV。报表显示的是有效提交次数，不是去重用户数。

检查未登录访问确实被拦截：

```bash
curl -I https://onlytranslate.top/internal/uninstall-report/
```

预期返回 `401 Unauthorized`。需要在命令行验证登录时运行 `curl -I -u admin URL`，
不要把密码直接写在命令中，curl 会交互式提示输入。

## 本地完整测试卸载反馈

本地完整测试使用独立的 Compose 项目、Caddy 配置和日志卷，不读取或污染线上数据。
本地端口只绑定到 `127.0.0.1`，因此报表不设置密码，也无法被局域网中的其他设备访问。

先构建并启动本地官网和 Caddy：

```bash
docker compose -f compose.local.yaml up --build
```

确认终端显示 Caddy 已启动后，再开一个终端启动指向本地官网的开发版扩展：

```bash
WXT_UNINSTALL_FEEDBACK_ORIGIN=http://localhost:8080 corepack pnpm dev
```

在 WXT 自动打开的测试 Chrome 中进入 `chrome://extensions`，找到只译并点击“移除”。
确认卸载后应自动打开本地问卷。提交问卷后访问：

```text
http://localhost:8080/internal/uninstall-report/
```

报表应显示刚提交的本地测试记录。禁用扩展、重新加载扩展或者停止开发命令都不会触发
卸载页面。需要重复测试时，停止并重新运行扩展开发命令。

测试结束后停止本地服务：

```bash
docker compose -f compose.local.yaml down
```

本地日志保存在 `onlytranslate-local_uninstall_feedback_local` 命名卷中，普通的 `down`
不会删除数据。只有明确需要清空本地测试数据时才运行：

```bash
docker compose -f compose.local.yaml down -v
```

`WXT_UNINSTALL_FEEDBACK_ORIGIN` 只在 WXT 的 `development` 模式下生效；生产构建始终
使用 `https://onlytranslate.top`。如果只想查看和操作问卷页面，仍可运行
`corepack pnpm site:dev`，但 VitePress 开发服务器不会记录或汇总反馈。

## 上线检查

```bash
curl -I http://onlytranslate.top
curl -I https://onlytranslate.top
curl -I https://www.onlytranslate.top
docker compose ps
docker compose logs --tail=100 website
```

预期根域名的 HTTP 返回 HTTPS 重定向，根域名的 HTTPS 返回成功状态，
`www.onlytranslate.top` 返回指向 `https://onlytranslate.top` 的 `308` 重定向。
首页、使用帮助、隐私说明和三段演示视频都应能正常打开与播放。

还应手动打开 `https://onlytranslate.top/uninstall?version=当前版本`，提交一份测试
反馈，再登录内部报表确认计数出现。测试反馈会作为一条匿名提交保留，可以在分析时
忽略。

如果域名尚未生效，可先用服务器 IP 测试 HTTP。编辑项目根目录已有的 `.env`，
只修改 `SITE_ADDRESS`，保留报表账号和密码哈希：

```dotenv
SITE_ADDRESS=http://服务器公网IP
```

测试完成并且域名解析生效后，把 `SITE_ADDRESS` 改回：

```dotenv
SITE_ADDRESS=onlytranslate.top
```

再运行 `docker compose up -d`，Caddy 会开始申请正式证书。
