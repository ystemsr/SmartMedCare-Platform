# K3s 部署（方案 C：混合部署）

把 **backend + frontend** 跑在 K3s，**MySQL / Redis / MinIO / Qdrant / Hadoop / Hive / Spark 继续留在 Docker**。零数据迁移、零代码改动。

## 拓扑

```
┌─────────────────────── K3s（containerd） ───────────────────────┐
│                                                                  │
│   Traefik Ingress :80                                           │
│        │                                                         │
│        └─→ Service/frontend ─→ Pod/frontend (nginx)             │
│                                       │                          │
│                                       └─/api/*→ Service/backend ─→ Pod/backend
│                                                                       │
│                                                          hostAliases  │
│                                                          docker.sock  │
└──────────────────────────────────────────────────────────────────┼────┘
                                                                   │
   宿主机端口 3306/6379/9000/6333/9870/10000/7077 ◀────────────────┘
                              │
┌──────────────────────────── Docker ────────────────────────────┐
│  mysql / redis / minio / qdrant / hadoop / hive / spark         │
│  （数据卷不动，原 docker-compose 继续管理）                      │
└─────────────────────────────────────────────────────────────────┘
```

## 关键点

- **服务发现**：backend Pod 的 `hostAliases` 把 `mysql` / `redis` / `minio` / `qdrant` / `hadoop-namenode` / `hive-server` / `spark-master` 等 docker-compose 服务名全部解析到 WSL2 主机 IP `172.30.240.74`，后端 `.env` 里的 `MYSQL_HOST=mysql` 等配置无需改动。
- **frontend → backend** 走 K8s CoreDNS 解析 `backend` Service，nginx 配置不变。
- **spark-submit**：backend Pod 通过 hostPath 挂载宿主机 `/var/run/docker.sock`，继续 `docker exec` docker 里的 spark-master。
- **spark 日志共享**：backend Pod 把宿主机 `/var/lib/docker/volumes/smartmedcare-platform_spark_logs/_data` 挂为 `/app/logs/spark`，与 docker spark-master 共享同一份日志目录。

## 前置条件

1. 本机已安装 K3s（可用 `kubectl get nodes` 验证）。
2. `~/.kube/config` 指向 K3s（用 `/etc/rancher/k3s/k3s.yaml`）。
3. docker-compose 中的 mysql/redis/minio/qdrant/hadoop/hive/spark 正在运行。
4. `.env` 已填好（用作 Secret 渲染源）。

## 部署

```bash
# 启动
./scripts/k3s-up.sh

# 卸载（不影响 docker 中的有状态服务）
./scripts/k3s-down.sh
```

`k3s-up.sh` 做 4 件事：
1. `docker build` 出 `smartmedcare-platform-backend:k3s` 和 `smartmedcare-platform-frontend:k3s`。
2. `docker save | sudo k3s ctr images import` —— K3s 用 containerd，看不到 docker 守护进程的镜像。
3. 从 `.env` 渲染 `secret.yaml` 临时文件（**不会写入仓库**）。
4. `kubectl apply` 所有 manifests，`rollout restart` 让新镜像生效。

## 访问

- 前端：<http://172.30.240.74/> 或 <http://localhost/>（Traefik 默认 `:80`）。
- API 健康：<http://172.30.240.74/api/v1/system/health>。
- 与 docker frontend `:3000` 不冲突，可并存对比。

## 与 docker-compose 的关系

- **不要**关掉 docker 中的 mysql / redis / minio / qdrant / hadoop / hive / spark —— K3s 中的 backend 依赖它们。
- 可以关掉 docker 中的 backend / frontend：`docker compose stop backend frontend`，避免端口/资源浪费。

## 常用排错

```bash
# 看 Pod 状态
kubectl -n smartmedcare get pods

# 看 backend 日志
kubectl -n smartmedcare logs deploy/backend -f

# 进 Pod 验证 docker 服务可达
kubectl -n smartmedcare exec -it deploy/backend -- /bin/bash
#   curl http://mysql:3306    # 应当 TCP 通（HTTP 报文不对没关系）
#   curl http://minio:9000/minio/health/live
#   curl http://qdrant:6333/healthz
```

## 已知限制

- **HDFS DataNode 端口未发布到宿主机**。如果 backend 通过 RPC 直连 DataNode 写数据会失败（NameNode 重定向到 docker 内部 IP）。WebHDFS（`:9870`）正常。
- backend Pod 拥有宿主机 docker 完全权限（docker.sock）。**仅供开发使用，不要这样发上生产**。
- 入口默认 HTTP 明文，没配 TLS。

## 后续可演进

1. **MySQL/MinIO 也搬到 K3s**：用 mysqldump / `mc mirror` 做一次冷迁移，PVC 走 `local-path-provisioner`。
2. **去掉 docker.sock 依赖**：把 spark-submit 改成走 Spark REST API 或 Spark Operator。
3. **TLS / Ingress 真域名**：把 Traefik 接 cert-manager。
