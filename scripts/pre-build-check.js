#!/usr/bin/env node
/**
 * Pre-build validation script
 * Checks that all necessary files and configurations are in place before building
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 运行构建前检查...\n');

const errors = [];
const warnings = [];

// Check electron-builder configuration exists
console.log('📋 检查 electron-builder 配置...');
const configPath = path.join(__dirname, '..', 'electron-builder.json5');
if (!fs.existsSync(configPath)) {
  errors.push('electron-builder.json5 未找到');
} else {
  console.log('  ✅ electron-builder.json5 存在');
}
console.log('');

// Check package.json scripts
console.log('📦 检查 package.json 脚本...');
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

const requiredScripts = ['rebuild', 'check:native', 'build:win', 'build:mac', 'build:linux'];
requiredScripts.forEach(script => {
  if (!pkg.scripts[script]) {
    errors.push(`缺少脚本: ${script}`);
  }
});

if (!pkg.devDependencies['electron-rebuild']) {
  warnings.push('electron-rebuild 不在 devDependencies 中（可选）');
}
console.log('  ✅ package.json 脚本 OK\n');

// Check native modules
console.log('🔧 检查原生模块...');
const nativeModules = ['better-sqlite3', 'keytar'];
nativeModules.forEach(mod => {
  const modPath = path.join(__dirname, '..', 'node_modules', mod);
  if (!fs.existsSync(modPath)) {
    errors.push(`原生模块未安装: ${mod}`);
  } else {
    const buildPath = path.join(modPath, 'build', 'Release');
    if (!fs.existsSync(buildPath)) {
      warnings.push(`原生模块未构建: ${mod} (electron-builder 会在构建时处理)`);
    } else {
      const nodeFiles = fs.readdirSync(buildPath).filter(f => f.endsWith('.node'));
      if (nodeFiles.length === 0) {
        warnings.push(`原生模块没有 .node 绑定: ${mod} (electron-builder 会在构建时处理)`);
      } else {
        console.log(`  ✅ ${mod}: ${nodeFiles.join(', ')}`);
      }
    }
  }
});
console.log('');

// Check if build directories exist
console.log('📁 检查构建目录...');
const distDir = path.join(__dirname, '..', 'dist');
const distElectronDir = path.join(__dirname, '..', 'dist-electron');
const buildDir = path.join(__dirname, '..', 'build');

if (fs.existsSync(distDir)) {
  warnings.push('dist 目录存在 (将被覆盖)');
}
if (fs.existsSync(distElectronDir)) {
  warnings.push('dist-electron 目录存在 (将被覆盖)');
}

// Check platform-specific resources
const platform = process.platform;
if (platform === 'darwin') {
  const icnsPath = path.join(buildDir, 'icon.icns');
  if (!fs.existsSync(icnsPath)) {
    warnings.push('macOS 图标未找到 (electron-builder 会自动生成)');
  } else {
    console.log('  ✅ 找到 macOS 图标');
  }
} else if (platform === 'win32') {
  const icoPath = path.join(buildDir, 'icon.ico');
  if (!fs.existsSync(icoPath)) {
    warnings.push('Windows 图标未找到 (electron-builder 会自动生成)');
  } else {
    console.log('  ✅ 找到 Windows 图标');
  }
} else if (platform === 'linux') {
  const iconsDir = path.join(buildDir, 'icons');
  if (!fs.existsSync(iconsDir)) {
    warnings.push('Linux 图标未找到 (electron-builder 会自动生成)');
  } else {
    console.log('  ✅ 找到 Linux 图标');
  }
  const desktopPath = path.join(buildDir, 'bingowork.desktop');
  if (!fs.existsSync(desktopPath)) {
    warnings.push('Linux .desktop 文件未找到');
  }
}

console.log('  ✅ 构建目录检查完成\n');

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (errors.length > 0) {
  console.log('❌ 错误:');
  errors.forEach(e => console.log(`  - ${e}`));
  console.log('');
  console.log('请在构建前修复这些错误。');
  process.exit(1);
}

if (warnings.length > 0) {
  console.log('⚠️  警告:');
  warnings.forEach(w => console.log(`  - ${w}`));
  console.log('');
}

console.log('✅ 构建前检查通过！现在可以运行构建。');
console.log('');
console.log('electron-builder 会自动处理:');
  console.log('  • 原生模块重建');
  console.log('  • 图标生成');
  console.log('  • 资源打包');
  console.log('');

process.exit(0);
