# AnyKeep 监控系统

基于 Prometheus + Grafana 的应用监控方案。

## 快速开始

### 1. 启动监控栈

```bash
cd monitoring
docker-compose up -d
```

### 2. 访问面板

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
  - 用户名: `admin`
  - 密码: `anykeep123` (或自定义 `GRAFANA_ADMIN_PASSWORD`)

### 3. 确保应用运行

```bash
# 在项目根目录
npm run dev
```

应用会在 http://localhost:3000/api/metrics 暴露 Prometheus 格式指标。

## 架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   AnyKeep   │────▶│  Prometheus │────▶│   Grafana   │
│  (Next.js)  │     │   (收集器)   │     │  (可视化)   │
│             │     │             │     │             │
│ /api/metrics│     │ :9090       │     │ :3001       │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 指标类型

### 分类系统指标

| 指标名                          | 类型      | 说明          |
| ------------------------------- | --------- | ------------- |
| `classification_requests_total` | Counter   | 分类请求总数  |
| `classification_success_total`  | Counter   | 分类成功数    |
| `classification_failures_total` | Counter   | 分类失败数    |
| `classification_latency_ms`     | Histogram | 分类延迟 (ms) |
| `classification_confidence`     | Histogram | 置信度分布    |
| `user_corrections_total`        | Counter   | 用户纠正次数  |

### 托管模式指标

| 指标名                          | 类型      | 说明         |
| ------------------------------- | --------- | ------------ |
| `trust_mode_distribution`       | Gauge     | 模式分布     |
| `trust_mode_switches_total`     | Counter   | 模式切换次数 |
| `pending_confirmations_gauge`   | Gauge     | 待确认消息数 |
| `confirmation_response_time_ms` | Histogram | 确认响应时间 |

### AI/向量搜索指标

| 指标名                     | 类型      | 说明         |
| -------------------------- | --------- | ------------ |
| `ai_calls_total`           | Counter   | AI 调用次数  |
| `ai_latency_ms`            | Histogram | AI 调用延迟  |
| `vector_search_total`      | Counter   | 向量搜索次数 |
| `vector_search_latency_ms` | Histogram | 向量搜索延迟 |

### 系统指标

| 指标名                   | 类型  | 说明             |
| ------------------------ | ----- | ---------------- |
| `nodejs_heap_size_bytes` | Gauge | Node.js 堆大小   |
| `nodejs_heap_used_bytes` | Gauge | Node.js 堆使用量 |
| `nodejs_uptime_seconds`  | Gauge | 进程运行时间     |

## 告警规则

预配置的告警规则 (`prometheus/alerts.yml`):

- **AnyKeepDown**: 应用不可用超过 1 分钟
- **HighClassificationErrorRate**: 分类错误率 > 10%
- **HighClassificationLatency**: P90 延迟 > 5 秒
- **HighAILatency**: AI 调用 P90 延迟 > 10 秒
- **HighMemoryUsage**: 内存使用率 > 90%
- **PendingConfirmationsBacklog**: 待确认消息 > 50

## 生产环境配置

### 1. 设置指标访问密钥

```bash
# .env.local
METRICS_SECRET=your-secure-secret-key
```

### 2. 更新 Prometheus 配置

```yaml
# prometheus/prometheus.yml
scrape_configs:
  - job_name: "anykeep"
    authorization:
      type: Bearer
      credentials: "your-secure-secret-key"
    static_configs:
      - targets: ["your-production-url.com"]
        labels:
          env: "production"
```

### 3. 更新 Grafana 密码

```bash
# docker-compose.yml 或环境变量
GRAFANA_ADMIN_PASSWORD=your-secure-password
```

## 自定义仪表板

预配置仪表板位于 `grafana/dashboards/`:

- `anykeep-overview.json` - 应用监控概览

可以在 Grafana UI 中创建新仪表板，导出 JSON 后放入此目录自动加载。

## 命令参考

```bash
# 启动监控栈
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止监控栈
docker-compose down

# 清理数据卷
docker-compose down -v

# 重启 Prometheus (配置更新后)
docker-compose restart prometheus

# 检查 Prometheus 配置
docker-compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

## 故障排查

### Prometheus 无法抓取指标

1. 检查应用是否运行: `curl http://localhost:3000/api/metrics`
2. 检查 Docker 网络: `docker network inspect monitoring_monitoring`
3. Windows/Mac 使用 `host.docker.internal` 访问宿主机

### Grafana 无数据

1. 检查数据源配置: Settings → Data Sources → Prometheus
2. 验证 Prometheus 是否有数据: http://localhost:9090/targets
3. 检查时间范围是否正确

## 相关文件

- `src/lib/metrics/classification-metrics.ts` - 指标收集器
- `src/lib/metrics/prometheus-exporter.ts` - Prometheus 导出器
- `src/app/api/metrics/route.ts` - 指标 API 端点
