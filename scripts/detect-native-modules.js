#!/usr/bin/env node
/**
 * Diagnostic script to detect native modules
 * Run this before building to ensure all native modules are properly configured
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nativeModules = [
  'better-sqlite3',
  'keytar'
];

console.log('🔍 检测原生模块...\n');

const problems = [];

nativeModules.forEach(moduleName => {
  const modulePath = path.join(__dirname, '..', 'node_modules', moduleName);

  console.log(`📦 ${moduleName}:`);

  // 检查模块是否存在
  if (!fs.existsSync(modulePath)) {
    console.log(`  ❌ 模块在 node_modules 中未找到`);
    problems.push(`${moduleName}: 模块未找到`);
    return;
  }

  // 检查 .node 文件
  const buildDir = path.join(modulePath, 'build', 'Release');
  if (fs.existsSync(buildDir)) {
    const files = fs.readdirSync(buildDir).filter(f => f.endsWith('.node'));
    if (files.length > 0) {
      console.log(`  ✅ 找到原生绑定: ${files.join(', ')}`);

      // 检查文件大小（应该 > 0）
      const bindingPath = path.join(buildDir, files[0]);
      const stats = fs.statSync(bindingPath);
      console.log(`  📊 大小: ${(stats.size / 1024).toFixed(2)} KB`);

      // 检查架构
      try {
        const output = execSync(`file -b "${bindingPath}"`, { encoding: 'utf-8' });
        console.log(`  🏗️  架构: ${output.trim()}`);
      } catch (error) {
        // 忽略
      }
    } else {
      console.log(`  ⚠️  在 build/Release 中没有找到 .node 文件`);
      problems.push(`${moduleName}: 没有找到原生绑定`);
    }
  } else {
    console.log(`  ⚠️  build/Release 目录不存在`);
    problems.push(`${moduleName}: 构建目录缺失`);
  }

  // 检查预构建文件
  const prebuildsDir = path.join(modulePath, 'prebuilds');
  if (fs.existsSync(prebuildsDir)) {
    const platforms = fs.readdirSync(prebuildsDir);
    console.log(`  🏗️  可用预构建: ${platforms.join(', ')}`);
  }

  console.log('');
});

if (problems.length > 0) {
  console.log('❌ 发现问题:');
  problems.forEach(p => console.log(`  - ${p}`));
  console.log('\n💡 尝试运行: npm run rebuild');
  process.exit(1);
} else {
  console.log('✅ 所有原生模块看起来都已正确构建！');
  process.exit(0);
}
