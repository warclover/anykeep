# Taste Review 知识库

代码审查的核心哲学、危险信号和经典示例。

## 来源

- Linus Torvalds TED Talk + Linux Kernel Coding Style
- John Ousterhout "A Philosophy of Software Design"
- Google Engineering Practices

## 附属资源

`source/` 目录用于存放项目相关的参考文档。根据项目使用的语言，可从官方仓库拉取对应的风格指南：

**Google Style Guides**: https://github.com/google/styleguide

| 语言 | 文件 |
|------|------|
| C++ | `cppguide.html` |
| Java | `javaguide.html` |
| Python | `pyguide.md` |
| JavaScript | `jsguide.html` |
| TypeScript | `tsguide.html` |
| Shell | `shellguide.md` |
| C# | `csharp-style.md` |

示例：项目使用 Python 和 TypeScript，可拉取对应文档：
```bash
mkdir -p source/google-style-guides
curl -o source/google-style-guides/pyguide.md https://raw.githubusercontent.com/google/styleguide/gh-pages/pyguide.md
curl -o source/google-style-guides/tsguide.html https://raw.githubusercontent.com/google/styleguide/gh-pages/tsguide.html
```

## 摘要

基于三大来源的代码审查参考资料：Linus 的好品味哲学、Ousterhout 的复杂性管理、Google 的代码健康标准。

## 适用场景

- 代码审查时需要理论依据
- 需要引用经典语录说明问题
- 需要好/坏代码对比示例

---

## 核心哲学

### Linus Torvalds: 好品味

> "Sometimes you can see a problem in a different way and rewrite it so that the special case goes away and becomes the normal case."

**核心原则**：
1. **消除特殊情况**：边界情况应该通过设计消除，而不是通过条件判断处理
2. **数据结构优先**：好程序员担心数据结构，糟糕程序员担心代码
3. **嵌套限制**：超过 3 层嵌套说明代码需要重构
4. **函数短小**：函数应该短小精悍，只做一件事
5. **局部变量限制**：局部变量不应超过 5-10 个，否则需要拆分函数
6. **Never break userspace**：用户可见行为不变是神圣不可侵犯的铁律
7. **快速暴露问题**：不要写 fallback/兼容/回退代码，让上游数据问题在测试中暴露

### John Ousterhout: 复杂性管理

> "Complexity is anything related to the structure of a software system that makes it hard to understand and modify."

**15 条设计原则**：

| # | 原则 | 说明 |
|---|------|------|
| 1 | 复杂性是逐步增加的 | 必须处理小事情，小问题会累积成大问题 |
| 2 | 能跑的代码是不够的 | Working code isn't enough |
| 3 | 持续小额投资改善设计 | Make continual small investments |
| 4 | 模块应该深 | 简单接口 + 强大功能 |
| 5 | 接口设计应简化常见用法 | 最常见的用法应该最简单 |
| 6 | 简单接口比简单实现重要 | 宁可复杂实现，不要复杂接口 |
| 7 | 通用模块更深 | General-purpose modules are deeper |
| 8 | 通用和专用代码分开 | Separate general-purpose and special-purpose |
| 9 | 不同层应有不同抽象 | Different layers, different abstractions |
| 10 | 复杂性下沉 | Pull complexity downward |
| 11 | 通过定义消除错误 | Define errors out of existence |
| 12 | **设计两次** | 重要设计至少考虑两个方案再选择 |
| 13 | 注释描述代码中不明显的 | Comments for non-obvious things |
| 14 | 为阅读而设计 | Design for reading, not writing |
| 15 | 增量是抽象而非功能 | Increments should be abstractions, not features |

**复杂性三大症状**：
1. **变更放大**：简单变更需要多处修改
2. **认知负荷**：开发者需要了解太多才能完成任务
3. **未知的未知**：不清楚哪些代码需要修改

**模块深度**：
- **深模块**：简单接口 + 强大功能
- **浅模块**：复杂接口 + 有限功能

### Google Code Review: 代码健康

> "A CL that improves the overall code health of the system should not be delayed for perfection."

**审查顺序**：设计 → 功能 → 复杂性 → 测试 → 命名 → 注释 → 风格 → 文档

**Small CLs 原则**：
- 100 行是合理的 CL 大小
- 1000 行通常太大
- 一个 CL 应该是 **one self-contained change**

---

## 危险信号清单

### Ousterhout 14 条危险信号

| # | 危险信号 | 描述 | 严重性 |
|---|----------|------|--------|
| 1 | 浅模块 | 接口复杂性 = 实现复杂性 | CRITICAL |
| 2 | 信息泄露 | 设计决策暴露在多个模块中 | CRITICAL |
| 3 | 时间分解 | 代码结构基于操作顺序而非信息隐藏 | WARNING |
| 4 | 过度暴露 | 常用功能需要了解罕用细节 | WARNING |
| 5 | Pass-Through 方法 | 几乎只转发参数到另一个方法 | WARNING |
| 6 | 代码重复 | 非平凡代码被反复复制 | CRITICAL |
| 7 | 特殊/通用混合 | 专用代码和通用代码未分离 | WARNING |
| 8 | 联合方法 | 两个方法强耦合，无法独立理解 | WARNING |
| 9 | 注释重复代码 | 注释只是复述代码 | WARNING |
| 10 | 实现污染接口 | 接口注释描述了不需要的实现细节 | WARNING |
| 11 | 含糊的名称 | 名称不够精确，无法传达有用信息 | WARNING |
| 12 | 难以命名 | 很难想出精确直观的名称 | WARNING |
| 13 | 难以描述 | 完整文档需要很长 | CRITICAL |
| 14 | 非显而易见的代码 | 行为或含义不容易理解 | CRITICAL |

### 代码结构危险信号

| 信号 | 阈值 | 严重性 |
|------|------|--------|
| 嵌套层次 | > 3 层 | CRITICAL |
| 函数长度 | > 100 行 | CRITICAL |
| 局部变量 | > 10 个 | WARNING |
| 无集中清理 | 多个退出点各自清理 | WARNING |

### 异常处理危险信号

| 信号 | 描述 | 严重性 |
|------|------|--------|
| 防御性默认值 | `?? 0` 或 `|| defaultValue` | WARNING |
| 过多异常 | try-catch 比业务逻辑还多 | CRITICAL |
| Fallback 代码 | 掩盖上游问题 | WARNING |

---

## 经典语录

### Linus Torvalds

| 场景 | 语录 |
|------|------|
| 防御性代码 | "Bad programmers worry about the code. Good programmers worry about data structures." |
| 深层嵌套 | "If you need more than 3 levels of indentation, you're screwed anyway." |
| 过度设计 | "Theory and practice sometimes clash. Theory loses. Every single time." |
| 特殊情况 | "Sometimes you can see a problem in a different way and rewrite it so that the special case goes away." |

### John Ousterhout

| 场景 | 语录 |
|------|------|
| 浅模块 | "Shallow modules don't help much in the battle against complexity." |
| 过多异常 | "The best way to eliminate exception handling complexity is to define your APIs so that there are no exceptions to handle." |
| Classitis | "Classes are good, so more classes are better - this is a mistake." |
| 设计 | "Design it twice. You'll end up with a much better result." |

### Google Code Review

| 场景 | 语录 |
|------|------|
| 评估变更 | "A CL that improves the overall code health of the system should not be delayed for perfection." |
| 过度工程 | "Encourage developers to solve the problem they know needs to be solved now, not the problem they speculate might need to be solved in the future." |
| 大 CL | "100 lines is usually a reasonable size for a CL, and 1000 lines is usually too large." |

---

## 经典示例

### 1. Linus 经典：链表删除

**糟糕品味（10行）**：
```c
void remove_list_entry(List *list, Entry *entry) {
    Entry *prev = NULL;
    Entry *walk = list->head;
    while (walk != entry) {
        prev = walk;
        walk = walk->next;
    }
    if (prev == NULL) {
        list->head = entry->next;  // 特殊情况：删除头节点
    } else {
        prev->next = entry->next;
    }
}
```

**好品味（4行）**：
```c
void remove_list_entry(List *list, Entry *entry) {
    Entry **indirect = &list->head;
    while (*indirect != entry)
        indirect = &(*indirect)->next;
    *indirect = entry->next;
}
```

**要点**：使用间接指针，让"删除头节点"和"删除普通节点"变成同一个操作。特殊情况消失了。

### 2. 深模块 vs 浅模块

**深模块（Unix I/O）**：
```c
int fd = open("/path/to/file", O_RDONLY);
char buf[1024];
ssize_t n = read(fd, buf, sizeof(buf));
close(fd);
```
5 个基本调用处理所有 I/O，隐藏了文件系统、缓冲、权限等复杂性。

**浅模块（Java 文件 I/O）**：
```java
FileInputStream fileStream = new FileInputStream(fileName);
BufferedInputStream bufferedStream = new BufferedInputStream(fileStream);
ObjectInputStream objectStream = new ObjectInputStream(bufferedStream);
```
需要了解 3 个类才能读取文件，接口复杂性 = 实现复杂性。

### 3. 防御性代码 vs 快速失败

**糟糕**：
```typescript
function processUser(user: User | null) {
    const name = user?.name ?? "Unknown";
    const email = user?.email ?? "";
    sendEmail(email, `Hello ${name}`);  // 发送到空地址？
}
```

**好**：
```typescript
function processUser(user: User) {
    sendEmail(user.email, `Hello ${user.name}`);
}
```

**要点**：不接受 null，让类型系统保证。如果上游传了 null，在测试阶段就会崩溃。

### 4. goto 集中清理

**糟糕（分散清理）**：
```c
int bad_init(void) {
    struct foo *foo = kmalloc(sizeof(*foo), GFP_KERNEL);
    if (!foo)
        return -ENOMEM;
    foo->bar = kmalloc(sizeof(*foo->bar), GFP_KERNEL);
    if (!foo->bar) {
        kfree(foo);  // 清理 1
        return -ENOMEM;
    }
    if (some_error) {
        kfree(foo->bar);  // 清理 2
        kfree(foo);
        return -EINVAL;
    }
    return 0;
}
```

**好（集中清理）**：
```c
int good_init(void) {
    int result = 0;
    struct foo *foo = kmalloc(sizeof(*foo), GFP_KERNEL);
    if (!foo) { result = -ENOMEM; goto out; }
    foo->bar = kmalloc(sizeof(*foo->bar), GFP_KERNEL);
    if (!foo->bar) { result = -ENOMEM; goto out_free_foo; }
    if (some_error) { result = -EINVAL; goto out_free_bar; }
    return 0;
out_free_bar:
    kfree(foo->bar);
out_free_foo:
    kfree(foo);
out:
    return result;
}
```

### 5. 不同层不同抽象

**糟糕（Pass-Through）**：
```typescript
// UI Layer
async function handleFileUploadButton() { await uploadFile(file); }
// Service Layer - 只是透传！
async function uploadFile(file: File) { await saveFile(file); }
// Data Layer - 还是透传！
async function saveFile(file: File) { await fs.writeFile(file.path, file.data); }
```

**好（每层不同抽象）**：
```typescript
// UI Layer - 用户交互
async function handleFileUploadButton() { /* 进度、错误展示 */ }
// Service Layer - 业务逻辑
async function storeDocument(file: File) { /* 验证、压缩、加密、索引 */ }
// Storage Layer - 持久化
async function save(data: Buffer) { /* 生成 ID、写入后端 */ }
```

---

## 评分标准

| 等级 | 条件 |
|------|------|
| **好品味** | 所有检查项通过或最多 1 个 WARNING；函数 < 50 行，嵌套 <= 2 层 |
| **凑合** | 2-3 个 WARNING，无 CRITICAL；函数 50-100 行，嵌套 = 3 层 |
| **垃圾** | 任意 CRITICAL 或 >= 4 个 WARNING；函数 > 100 行或嵌套 > 3 层 |
