#!/usr/bin/env node
/**
 * Windows Build Verification Script
 * Checks if the Windows build contains all necessary native modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 验证 Windows 构建...\n');

const errors = [];
const warnings = [];

// Find Windows build directories
const releaseDir = path.join(__dirname, '..', 'release');
if (!fs.existsSync(releaseDir)) {
  console.error('❌ release 目录不存在');
  console.log('请先运行: npm run build:win');
  process.exit(1);
}

// Find all version directories
const versionDirs = fs.readdirSync(releaseDir)
  .filter(f => fs.statSync(path.join(releaseDir, f)).isDirectory())
  .filter(f => f.match(/^\d+\.\d+\.\d+$/));

if (versionDirs.length === 0) {
  console.error('❌ 没有找到构建版本');
  process.exit(1);
}

const latestVersion = versionDirs.sort().reverse()[0];
const buildPath = path.join(releaseDir, latestVersion);

console.log(`📦 检查版本: ${latestVersion}\n`);

// Check Windows unpacked directory
const winUnpacked = path.join(buildPath, 'win-unpacked');
if (!fs.existsSync(winUnpacked)) {
  errors.push('win-unpacked 目录不存在');
} else {
  console.log('✅ 找到 win-unpacked 目录');

  // Check resources
  const resourcesPath = path.join(winUnpacked, 'resources');
  if (!fs.existsSync(resourcesPath)) {
    errors.push('resources 目录不存在');
  } else {
    console.log('✅ 找到 resources 目录');

    // Check app.asar
    const appAsar = path.join(resourcesPath, 'app.asar');
    if (!fs.existsSync(appAsar)) {
      errors.push('app.asar 不存在');
    } else {
      const stats = fs.statSync(appAsar);
      console.log(`✅ 找到 app.asar (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // Check app.asar.unpacked
    const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked');
    if (!fs.existsSync(unpackedPath)) {
      errors.push('app.asar.unpacked 目录不存在 - 这是严重问题！');
      errors.push('原生模块 (better-sqlite3, keytar) 将无法加载');
    } else {
      console.log('✅ 找到 app.asar.unpacked 目录');

      // Check native modules
      const nodeModulesPath = path.join(unpackedPath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        errors.push('app.asar.unpacked/node_modules 目录不存在');
      } else {
        const requiredModules = ['better-sqlite3', 'keytar', '@modelcontextprotocol'];

        requiredModules.forEach(mod => {
          const modPath = path.join(nodeModulesPath, mod);
          if (!fs.existsSync(modPath)) {
            errors.push(`缺少原生模块: ${mod}`);
          } else {
            console.log(`✅ 找到模块: ${mod}`);

            // Check for .node files
            if (mod === 'better-sqlite3' || mod === 'keytar') {
              const buildPath = path.join(modPath, 'build', 'Release');
              if (fs.existsSync(buildPath)) {
                const nodeFiles = fs.readdirSync(buildPath).filter(f => f.endsWith('.node'));
                if (nodeFiles.length === 0) {
                  errors.push(`${mod} 没有 .node 文件`);
                } else {
                  console.log(`  ✅ ${mod} 原生绑定: ${nodeFiles.join(', ')}`);
                }
              } else {
                warnings.push(`${mod} build 目录不存在`);
              }
            }
          }
        });
      }
    }
  }
}

// Check NSIS installer
const setupExe = path.join(buildPath, 'Bingowork-Windows-*-Setup.exe');
const setupFiles = fs.readdirSync(buildPath).filter(f => f.match(/Bingowork-Windows-.*-Setup\.exe$/));

if (setupFiles.length === 0) {
  warnings.push('未找到 NSIS 安装程序 (Bingowork-Windows-*-Setup.exe)');
} else {
  console.log(`\n✅ 找到安装程序: ${setupFiles.join(', ')}`);
}

// Check latest.yml
const latestYml = path.join(buildPath, 'latest.yml');
if (!fs.existsSync(latestYml)) {
  warnings.push('未找到 latest.yml (自动更新配置)');
} else {
  console.log('✅ 找到 latest.yml');
}

// Summary
console.log('\n' + '='.repeat(50) + '\n');

if (errors.length > 0) {
  console.log('❌ 错误:');
  errors.forEach(e => console.log(`  - ${e}`));
  console.log('');
  console.log('🔧 修复建议:');
  console.log('  1. 清理构建: rm -rf release/ dist/ dist-electron/');
  console.log('  2. 重新构建: npm run build:win');
  console.log('  3. 或者使用 GitHub Actions 在 Windows 环境构建');
  console.log('');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('⚠️  警告:');
  warnings.forEach(w => console.log(`  - ${w}`));
  console.log('');
}

console.log('✅ Windows 构建验证通过！');
console.log('');
console.log('下一步:');
console.log('  1. 在 Windows 10/11 上安装测试');
console.log('  2. 验证数据库功能');
console.log('  3. 验证 API 密钥存储');
console.log('  4. 验证所有核心功能');
console.log('');

process.exit(0);
