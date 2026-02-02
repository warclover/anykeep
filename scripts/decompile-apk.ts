#!/usr/bin/env ts-node
/**
 * APK 反编译工具
 * 使用 jadx 或 apktool 反编译 APK 文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface DecompileOptions {
  apkPath: string;
  outputDir?: string;
  tool?: 'jadx' | 'apktool';
  extractResources?: boolean;
}

class APKDecompiler {
  private apkPath: string;
  private outputDir: string;
  private tool: 'jadx' | 'apktool';

  constructor(options: DecompileOptions) {
    this.apkPath = path.resolve(options.apkPath);
    this.outputDir = options.outputDir || path.join(path.dirname(this.apkPath), 'decompiled');
    this.tool = options.tool || 'jadx';

    if (!fs.existsSync(this.apkPath)) {
      throw new Error(`APK 文件不存在: ${this.apkPath}`);
    }
  }

  /**
   * 检查工具是否已安装
   */
  private checkToolInstalled(): boolean {
    try {
      if (this.tool === 'jadx') {
        execSync('jadx --version', { stdio: 'ignore' });
        return true;
      } else {
        execSync('apktool --version', { stdio: 'ignore' });
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * 使用 jadx 反编译
   */
  private decompileWithJadx(): void {
    console.log('🔍 使用 jadx 反编译 APK...');
    
    const jadxArgs = [
      '-d', this.outputDir,
      '--show-bad-code',
      '--no-imports',
      this.apkPath
    ];

    try {
      execSync(`jadx ${jadxArgs.join(' ')}`, { 
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      console.log(`✅ 反编译完成！输出目录: ${this.outputDir}`);
    } catch (error: any) {
      throw new Error(`jadx 反编译失败: ${error.message}`);
    }
  }

  /**
   * 使用 apktool 反编译
   */
  private decompileWithApktool(): void {
    console.log('🔍 使用 apktool 反编译 APK...');
    
    const apktoolArgs = [
      'd',
      '-f',
      '-o', this.outputDir,
      this.apkPath
    ];

    try {
      execSync(`apktool ${apktoolArgs.join(' ')}`, { 
        stdio: 'inherit',
        encoding: 'utf-8'
      });
      console.log(`✅ 反编译完成！输出目录: ${this.outputDir}`);
    } catch (error: any) {
      throw new Error(`apktool 反编译失败: ${error.message}`);
    }
  }

  /**
   * 显示安装指南
   */
  private showInstallGuide(): void {
    console.log('\n📦 需要安装反编译工具：\n');
    
    if (this.tool === 'jadx') {
      console.log('方法 1: 使用 Chocolatey (推荐)');
      console.log('  choco install jadx\n');
      
      console.log('方法 2: 手动下载');
      console.log('  1. 访问 https://github.com/skylot/jadx/releases');
      console.log('  2. 下载 jadx-*-windows.zip');
      console.log('  3. 解压到任意目录');
      console.log('  4. 将 jadx/bin 目录添加到 PATH 环境变量\n');
      
      console.log('方法 3: 使用 Scoop');
      console.log('  scoop install jadx\n');
    } else {
      console.log('方法 1: 使用 Chocolatey');
      console.log('  choco install apktool\n');
      
      console.log('方法 2: 手动安装');
      console.log('  1. 下载 apktool.jar: https://ibotpeaches.github.io/Apktool/');
      console.log('  2. 下载 aapt2: https://github.com/google/android-build-tools');
      console.log('  3. 配置环境变量\n');
    }
  }

  /**
   * 执行反编译
   */
  public decompile(): void {
    console.log(`📱 APK 文件: ${this.apkPath}`);
    console.log(`📂 输出目录: ${this.outputDir}`);
    console.log(`🛠️  使用工具: ${this.tool}\n`);

    if (!this.checkToolInstalled()) {
      console.error(`❌ 未检测到 ${this.tool}，请先安装！`);
      this.showInstallGuide();
      process.exit(1);
    }

    // 创建输出目录
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    try {
      if (this.tool === 'jadx') {
        this.decompileWithJadx();
      } else {
        this.decompileWithApktool();
      }

      // 显示输出目录结构
      this.showOutputStructure();
    } catch (error: any) {
      console.error(`❌ 反编译失败: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * 显示输出目录结构
   */
  private showOutputStructure(): void {
    console.log('\n📁 输出目录结构:');
    
    const showDir = (dir: string, prefix: string = '', maxDepth: number = 3, currentDepth: number = 0): void => {
      if (currentDepth >= maxDepth) return;
      
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const dirs = items.filter(item => item.isDirectory());
        const files = items.filter(item => item.isFile());

        // 显示目录
        dirs.slice(0, 10).forEach((item, index) => {
          const isLast = index === dirs.length - 1 && files.length === 0;
          const connector = isLast ? '└── ' : '├── ';
          console.log(`${prefix}${connector}${item.name}/`);
          
          if (currentDepth < maxDepth - 1) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            showDir(path.join(dir, item.name), nextPrefix, maxDepth, currentDepth + 1);
          }
        });

        if (dirs.length > 10) {
          console.log(`${prefix}└── ... (还有 ${dirs.length - 10} 个目录)`);
        }

        // 显示文件（最多 5 个）
        files.slice(0, 5).forEach((item, index) => {
          const isLast = index === files.length - 1;
          const connector = isLast ? '└── ' : '├── ';
          const size = fs.statSync(path.join(dir, item.name)).size;
          const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`;
          console.log(`${prefix}${connector}${item.name} (${sizeStr})`);
        });

        if (files.length > 5) {
          console.log(`${prefix}└── ... (还有 ${files.length - 5} 个文件)`);
        }
      } catch (error) {
        // 忽略权限错误
      }
    };

    showDir(this.outputDir);
    console.log('');
  }
}

// 命令行参数解析
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法: npm run decompile:apk <apk文件路径> [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --output, -o <目录>    指定输出目录 (默认: <apk目录>/decompiled)');
  console.log('  --tool <工具>          指定工具: jadx 或 apktool (默认: jadx)');
  console.log('');
  console.log('示例:');
  console.log('  npm run decompile:apk shao.apk');
  console.log('  npm run decompile:apk shao.apk --output ./output');
  console.log('  npm run decompile:apk shao.apk --tool apktool');
  process.exit(1);
}

const apkPath = args[0];
let outputDir: string | undefined;
let tool: 'jadx' | 'apktool' = 'jadx';

for (let i = 1; i < args.length; i++) {
  if ((args[i] === '--output' || args[i] === '-o') && i + 1 < args.length) {
    outputDir = args[++i];
  } else if (args[i] === '--tool' && i + 1 < args.length) {
    const toolArg = args[++i];
    if (toolArg === 'jadx' || toolArg === 'apktool') {
      tool = toolArg;
    } else {
      console.error(`❌ 无效的工具: ${toolArg}，只支持 jadx 或 apktool`);
      process.exit(1);
    }
  }
}

// 执行反编译
try {
  const decompiler = new APKDecompiler({
    apkPath,
    outputDir,
    tool
  });
  decompiler.decompile();
} catch (error: any) {
  console.error(`❌ 错误: ${error.message}`);
  process.exit(1);
}
