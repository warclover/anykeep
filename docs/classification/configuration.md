# 智能分类配置指南

**版本**: v2.0
**更新日期**: 2026-01-24

---

## 一、环境变量配置

### 1.1 策略选择

```bash
# 默认策略: modern | classic
CLASSIFICATION_DEFAULT_STRATEGY=modern

# 强制指定版本（优先级最高）
# v4.1 = Classic, v5.0 = Modern
CLASSIFICATION_VERSION=v5.0
```

### 1.2 灰度发布

```bash
# 灰度比例 (0-100)
# 0 = 全部使用 Classic
# 100 = 全部使��� Modern
CLASSIFICATION_ROLLOUT_STAGE=100

# 白名单用户（逗号分隔）
CLASSIFICATION_WHITELIST=user-id-1,user-id-2

# 黑名单用户（逗号分隔）
CLASSIFICATION_BLACKLIST=user-id-3
```

### 1.3 Modern 策略配置

```bash
# L0 规则匹配
CLASSIFICATION_ENABLE_L0_RULES=true

# T1 LLM 纠正
CLASSIFICATION_ENABLE_T1=true

# 晶体生长（V5.5 功能）
CLASSIFICATION_ENABLE_CRYSTAL=false
```

### 1.4 Classic 策略配置

```bash
# AI 选择题模式
CLASSIFICATION_ENABLE_AI_SELECT=true

# AI 创建文件夹
CLASSIFICATION_ENABLE_AI_CREATE=true

# CoT 思维链 Prompt
V3_ENABLE_COT_PROMPT=true

# 反馈闭环
V3_ENABLE_FEEDBACK_LOOP=true

# k-NN 直接锁定
V3_ENABLE_KNN_DIRECT=true
```

### 1.5 置信度阈值

```bash
# 自动分类阈值 (0-100)
# 置信度 >= 此值时自动分类
CLASSIFICATION_AUTO_THRESHOLD=80

# 建议阈值 (0-100)
# 置信度在此值到自动阈值之间时生成建议
CLASSIFICATION_SUGGEST_THRESHOLD=60

# T1 触发阈值 (0-100)
# T0 置信度 < 此值时触发 T1 纠正
CLASSIFICATION_T1_THRESHOLD=70
```

### 1.6 性能配置

```bash
# Pipeline 缓存
CLASSIFICATION_ENABLE_CACHE=true

# 缓存 TTL（毫秒）
CLASSIFICATION_CACHE_TTL_MS=600000
```

### 1.7 晶体生长配置 (V5.5)

```bash
# V5.5 主开关
V55_ENABLED=false

# 混沌池写入
V55_CHAOS_POOL_ENABLED=true

# 晶体生长（静默创建）
V55_CRYSTAL_GROWTH_ENABLED=true

# 异步命名优化
V55_ASYNC_NAMING_ENABLED=true

# 静默通知
V55_SILENT_NOTIFICATION=true

# 影子模式（仅记录不执行）
V55_SHADOW_MODE=false

# 详细日志
V55_DEBUG_LOG=false

# 灰度比例 (0-100)
V55_ROLLOUT_PERCENT=0
```

---

## 二、配置优先级

```
环境变量 > 代码默认值
     │
     ├── CLASSIFICATION_VERSION (强制指定)
     │        ↓
     ├── 用户黑名单检查
     │        ↓
     ├── 用户白名单检查
     │        ↓
     └── 灰度比例分桶
```

---

## 三、推荐配置

### 3.1 开发环境

```bash
CLASSIFICATION_DEFAULT_STRATEGY=modern
CLASSIFICATION_ROLLOUT_STAGE=100
CLASSIFICATION_ENABLE_T1=true
V55_ENABLED=false
V55_DEBUG_LOG=true
```

### 3.2 生产环境（保守）

```bash
CLASSIFICATION_DEFAULT_STRATEGY=modern
CLASSIFICATION_ROLLOUT_STAGE=100
CLASSIFICATION_ENABLE_T1=true
CLASSIFICATION_ENABLE_CRYSTAL=false
V55_ENABLED=false
```

### 3.3 生产环境（完整功能）

```bash
CLASSIFICATION_DEFAULT_STRATEGY=modern
CLASSIFICATION_ROLLOUT_STAGE=100
CLASSIFICATION_ENABLE_T1=true
CLASSIFICATION_ENABLE_CRYSTAL=true
V55_ENABLED=true
V55_ROLLOUT_PERCENT=20
V55_SHADOW_MODE=false
```

---

## 四、Feature Flags 一览

| Flag                  | 默认值 | 说明          |
| --------------------- | ------ | ------------- |
| `enableL0Rules`       | true   | L0 规则匹配   |
| `enableT1Correction`  | true   | T1 LLM 纠正   |
| `enableCrystalGrowth` | false  | 晶体生长      |
| `enableAISelection`   | true   | AI 选择题模式 |
| `enableAICreate`      | true   | AI 创建文件夹 |
| `enableCoTPrompt`     | true   | CoT 思维链    |
| `enableFeedbackLoop`  | true   | 反馈闭环      |
| `enableKnnDirect`     | true   | k-NN 直接锁定 |
| `enablePipelineCache` | true   | Pipeline 缓存 |

---

## 五、监控指标

建议监控以下指标：

| 指标                                  | 告警阈值 | 说明          |
| ------------------------------------- | -------- | ------------- |
| `classification.success_rate`         | < 95%    | 分类成功率    |
| `classification.latency_p99`          | > 5000ms | P99 延迟      |
| `classification.t1_trigger_rate`      | > 50%    | T1 触发率过高 |
| `classification.user_correction_rate` | > 20%    | 用户纠正率    |
