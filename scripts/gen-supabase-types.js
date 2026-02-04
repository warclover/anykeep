#!/usr/bin/env node
/**
 * Supabase 类型生成脚本（跨平台安全版）
 *
 * 解决 Windows 下 `>` 重定向导致的编码问题：
 * - 确保 UTF-8 编码（无 BOM）
 * - 统一 LF 行尾符
 * - 错误处理和日志输出
 *
 * 使用方式：
 *   node scripts/gen-supabase-types.js [--local]
 *
 * 参数：
 *   --local  使用本地 Supabase 实例（需要 Docker）
 *   默认使用远程项目
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 配置
const CONFIG = {
  projectId: 'guwtnzcumkqsdcwrmdta',
  outputPath: path.join(__dirname, '../src/types/supabase.generated.ts'),
  schema: 'public',
  maxBuffer: 20 * 1024 * 1024, // 20MB，防止大型 schema 溢出
}

// 解析命令行参数
const useLocal = process.argv.includes('--local')

// 构建命令
function buildCommand() {
  const baseCmd = 'npx supabase gen types typescript'
  const schemaFlag = `--schema ${CONFIG.schema}`

  if (useLocal) {
    console.log('📦 使用本地 Supabase 实例...')
    return `${baseCmd} --local ${schemaFlag}`
  } else {
    console.log('☁️  使用远程 Supabase 项目...')
    return `${baseCmd} --project-id ${CONFIG.projectId} ${schemaFlag}`
  }
}

// 标准化行尾符为 LF
function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// 添加文件头注释
function addFileHeader(content) {
  const header = `/**
 * 此文件由 scripts/gen-supabase-types.js 自动生成
 * 生成时间: ${new Date().toISOString()}
 *
 * ⚠️ 请勿手动修改此文件！
 * 如需扩展类型，请在 src/types/supabase.ts 中添加
 *
 * 重新生成命令: npm run supabase:gen:types
 */

`
  return header + content
}

// 主函数
async function main() {
  const startTime = Date.now()

  try {
    const command = buildCommand()
    console.log(`🔧 执行命令: ${command}\n`)

    // 执行命令并捕获输出
    const rawOutput = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: CONFIG.maxBuffer,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // 处理输出
    let content = normalizeLineEndings(rawOutput)
    content = addFileHeader(content)

    // 确保目录存在
    const outputDir = path.dirname(CONFIG.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 写入文件（UTF-8 无 BOM）
    fs.writeFileSync(CONFIG.outputPath, content, { encoding: 'utf-8' })

    // 统计信息
    const stats = fs.statSync(CONFIG.outputPath)
    const lineCount = content.split('\n').length
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('✅ 类型生成成功！')
    console.log(`   📄 文件: ${CONFIG.outputPath}`)
    console.log(`   📏 大小: ${(stats.size / 1024).toFixed(2)} KB`)
    console.log(`   📝 行数: ${lineCount}`)
    console.log(`   ⏱️  耗时: ${elapsed}s`)

    // 提示下一步
    console.log('\n💡 建议运行类型检查确认无冲突:')
    console.log('   npm run type-check')
  } catch (error) {
    console.error('\n❌ 类型生成失败！')

    if (error.stderr) {
      console.error('\n错误详情:')
      console.error(error.stderr.toString())
    }

    if (error.message.includes('not logged in')) {
      console.error('\n🔐 请先登录 Supabase:')
      console.error('   npx supabase login')
    } else if (error.message.includes('docker')) {
      console.error('\n🐳 本地模式需要 Docker，请使用远程模式:')
      console.error('   node scripts/gen-supabase-types.js')
    }

    process.exit(1)
  }
}

main()
