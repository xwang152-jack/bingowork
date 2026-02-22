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

// Check electron-builder configuration
console.log('📋 检查 electron-builder 配置...');
const configPath = path.join(__dirname, '..', 'electron-builder.json5');
if (!fs.existsSync(configPath)) {
  errors.push('electron-builder.json5 未找到');
} else {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  // 简单的 JSON5 解析（移除注释）
  const config = JSON.parse(configContent.replace(/\/\/.*$/gm, ''));

  if (!config.asarUnpack) {
    errors.push('electron-builder.json5 缺少 asarUnpack 配置');
  } else {
    const requiredModules = ['better-sqlite3', 'keytar'];
    requiredModules.forEach(mod => {
      if (!config.asarUnpack.some(p => p.includes(mod))) {
        errors.push(`asarUnpack 缺少 ${mod}`);
      }
    });
  }
  console.log('  ✅ electron-builder 配置 OK\n');
}

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
  errors.push('electron-rebuild 不在 devDependencies 中');
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
      warnings.push(`原生模块未构建: ${mod} (运行 npm run rebuild)`);
    } else {
      const nodeFiles = fs.readdirSync(buildPath).filter(f => f.endsWith('.node'));
      if (nodeFiles.length === 0) {
        errors.push(`原生模块没有 .node 绑定: ${mod}`);
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
    warnings.push('macOS 图标未找到 (运行: npm run build:icons)');
  } else {
    console.log('  ✅ 找到 macOS 图标');
  }
} else if (platform === 'win32') {
  const icoPath = path.join(buildDir, 'icon.ico');
  if (!fs.existsSync(icoPath)) {
    warnings.push('Windows 图标未找到 (运行: npm run build:icons)');
  } else {
    console.log('  ✅ 找到 Windows 图标');
  }
} else if (platform === 'linux') {
  const iconsDir = path.join(buildDir, 'icons');
  if (!fs.existsSync(iconsDir)) {
    warnings.push('Linux 图标未找到 (运行: npm run build:icons)');
  } else {
    console.log('  ✅ 找到 Linux 图标');
  }
  const desktopPath = path.join(buildDir, 'bingowork.desktop');
  if (!fs.existsSync(desktopPath)) {
    errors.push('Linux .desktop 文件未找到');
  }
}

console.log('  ✅ 构建目录 OK\n');

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
console.log('下一步:');
console.log('  1. 运行: npm run rebuild');
console.log('  2. 运行: npm run check:native');
console.log('  3. 运行: npm run build:win   (Windows)');
console.log('     或: npm run build:mac    (macOS)');
console.log('     或: npm run build:linux  (Linux)');
console.log('');

process.exit(0);
