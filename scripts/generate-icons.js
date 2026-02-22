#!/usr/bin/env node
/**
 * Icon generation script for Electron apps
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceIcon = path.join(__dirname, '..', 'public', 'icon.png');
const buildDir = path.join(__dirname, '..', 'build');

console.log('🎨 生成 macOS 图标...\n');

// 检查源图标是否存在
if (!fs.existsSync(sourceIcon)) {
  console.error('❌ 源图标未找到:', sourceIcon);
  console.log('请在 public/icon.png 放置一个 1024x1024 的 PNG 图标');
  process.exit(1);
}

// 确保 build 目录存在
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

try {
  // macOS: 生成 .icns 文件
  console.log('🍎 生成 macOS .icns 图标...');

  const iconsetDir = path.join(buildDir, 'icon.iconset');
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // 生成所有需要的尺寸
  const sizes = [
    16, 32, 64, 128, 256, 512, 1024
  ];

  sizes.forEach(size => {
    const retinaSize = size * 2;

    // 常规尺寸
    try {
      execSync(
        `sips -z ${size} ${size} "${sourceIcon}" --out "${iconsetDir}/icon_${size}x${size}.png"`,
        { stdio: 'ignore' }
      );
    } catch (error) {
      console.warn(`  ⚠️  无法生成 ${size}x${size}:`, error.message);
    }

    // Retina 尺寸
    try {
      execSync(
        `sips -z ${retinaSize} ${retinaSize} "${sourceIcon}" --out "${iconsetDir}/icon_${size}x${size}@2x.png"`,
        { stdio: 'ignore' }
      );
    } catch (error) {
      console.warn(`  ⚠️  无法生成 ${retinaSize}x${retinaSize}:`, error.message);
    }
  });

  // 从 iconset 创建 .icns
  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('⚠️  iconutil 命令失败，使用备用方法...');
    // 备用：直接复制一个 PNG 图标
    execSync(`sips -s format icns "${sourceIcon}" --out "${path.join(buildDir, 'icon.icns')}"`, {
      stdio: 'ignore'
    });
  }

  // 清理 iconset
  try {
    fs.rmSync(iconsetDir, { recursive: true, force: true });
  } catch (error) {
    // 忽略清理错误
  }

  // 验证文件是否创建
  const icnsPath = path.join(buildDir, 'icon.icns');
  if (fs.existsSync(icnsPath)) {
    const stats = fs.statSync(icnsPath);
    console.log(`  ✅ 已创建: build/icon.icns (${(stats.size / 1024).toFixed(2)} KB)\n`);
  } else {
    console.log('  ⚠️  icon.icns 未创建，可能需要手动转换\n');
    console.log('  💡 提示: 可以使用在线工具将 PNG 转换为 ICNS:');
    console.log('     https://cloudconvert.com/png-to-icns\n');
  }

  console.log('✅ 图标生成完成!');

} catch (error) {
  console.error('\n❌ 图标生成失败:', error.message);
  process.exit(1);
}
