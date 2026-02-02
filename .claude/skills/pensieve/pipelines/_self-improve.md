# Self-Improve Pipeline

---
description: 知识沉淀流程。当 loop 完成、用户说"沉淀"、"记录下来"、"保存经验"时触发。
---

You are helping capture learnings and patterns into Pensieve's knowledge system. Determine what's worth preserving, categorize it correctly, and write it in the proper format.

## Core Principles

- **User confirmation required**: Never auto-capture — always ask first
- **Read before write**: Must read the target README before creating any file
- **Deletion over addition**: Simpler system is more reliable
- **Right category**: Match content to the correct knowledge type

---

## Phase 1: Understand Intent

**Goal**: Clarify what the user wants to capture

**Actions**:
1. Identify the source:
   - Loop deviation (expected vs actual)
   - Discovered pattern during work
   - Explicit user instruction
   - External reference material

2. Ask clarifying questions if needed:
   - What specific insight should be captured?
   - What triggered this realization?
   - How general is this learning?

---

## Phase 2: Categorize

**Goal**: Determine the correct knowledge type

**Actions**:
1. Evaluate content against each category:

| Type | Characteristics | README |
|------|-----------------|--------|
| **maxim** | Universal principles — applies across projects, languages, domains | `maxims/README.md` |
| **decision** | Context-dependent choices — specific to situation or project | `decisions/README.md` |
| **pipeline** | Executable workflows — repeatable process with clear steps | `pipelines/README.md` |
| **knowledge** | External references — docs, tutorials, specifications | `knowledge/README.md` |

2. **Present categorization to user**:
   ```markdown
   ## 沉淀建议

   [内容描述] → 建议沉淀为 **[类型]**

   理由：[基于 README 判断标准的解释]

   是否同意？
   ```

**CRITICAL**: Wait for user confirmation before proceeding.

---

## Phase 3: Read Target README

**Goal**: Understand the exact format and criteria for the chosen category

**DO NOT SKIP**: This phase is mandatory. The README defines:
- Capture criteria (what's worth capturing)
- File format requirements
- Naming conventions
- Examples

**Actions**:
1. Read the corresponding README:
   ```
   Read skills/pensieve/{type}/README.md
   ```

2. Verify the content meets the capture criteria defined in README

3. If content doesn't meet criteria, explain to user and ask how to proceed

---

## Phase 4: Draft Content

**Goal**: Write content following the README format exactly

**Actions**:
1. Draft the file content following README specifications

2. **Present draft to user for review**:
   ```markdown
   ## 草稿预览

   文件：`{type}/{filename}.md`

   ---
   [draft content]
   ---

   确认写入？
   ```

**CRITICAL**: Wait for user approval before writing.

---

## Phase 5: Write

**Goal**: Persist the knowledge

**DO NOT START WITHOUT USER APPROVAL** from Phase 4.

**Actions**:
1. Write the file to the correct location
2. Confirm successful write to user
3. Suggest any related follow-up actions (e.g., update other files that reference this)

---

## Knowledge Evolution

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │
│  │   maxims/   │   │ decisions/  │   │ pipelines/  │   │ knowledge/  │  │
│  │  未来指导    │ ← │  过去经验    │   │  工作定义    │   │  外部输入    │  │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Evolution path: decision → repeated pattern → maxim → guides → pipeline
```

---

## Related Files

- `maxims/README.md` — Maxim format and criteria
- `decisions/README.md` — Decision format and criteria
- `pipelines/README.md` — Pipeline format and criteria
- `knowledge/README.md` — Knowledge format and criteria
