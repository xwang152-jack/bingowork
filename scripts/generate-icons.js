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

const platform = process.platform;

console.log(`🎨 生成 ${platform} 图标...\n`);

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
  if (platform === 'darwin') {
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
        console.warn(`  ⚠️  无法生成 ${size}x${size}: ${error.message}`);
      }

      // Retina 尺寸
      try {
        execSync(
          `sips -z ${retinaSize} ${retinaSize} "${sourceIcon}" --out "${iconsetDir}/icon_${size}x${size}@2x.png"`,
          { stdio: 'ignore' }
        );
      } catch (error) {
        console.warn(`  ⚠️  无法生成 ${retinaSize}x${retinaSize}: ${error.message}`);
      }
    });

    // 从 iconset 创建 .icns
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.warn('⚠️  iconutil 命令失败，跳过 macOS 图标生成');
      console.log('  ℹ️  macOS 图标将在构建时由 electron-builder 生成');
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
      console.log('  ℹ️  macOS 图标将由 electron-builder 自动生成\n');
    }

  } else if (platform === 'win32') {
    // Windows: 跳过，electron-builder 会处理
    console.log('🪟 Windows 图标将由 electron-builder 生成');
    console.log('  ℹ️  确保 build/icon.ico 存在，或 electron-builder 会从源图标生成\n');

  } else if (platform === 'linux') {
    // Linux: 生成多尺寸 PNG 图标
    console.log('🐧 生成 Linux 图标...');

    const iconDir = path.join(buildDir, 'icons');
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }

    const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

    let generatedCount = 0;
    sizes.forEach(size => {
      const outputPath = path.join(iconDir, `${size}x${size}`, 'bingowork.png');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      try {
        // 尝试使用 ImageMagick
        execSync(
          `convert "${sourceIcon}" -resize ${size}x${size} "${outputPath}"`,
          { stdio: 'ignore' }
        );
        console.log(`  ✅ 已创建: ${size}x${size}/bingowork.png`);
        generatedCount++;
      } catch (error) {
        // ImageMagick 不可用，跳过
        console.warn(`  ⚠️  跳过 ${size}x${size} (ImageMagick 未安装)`);
      }
    });

    if (generatedCount > 0) {
      console.log(`\n✅ Linux 图标生成完成 (${generatedCount}/${sizes.length})\n`);
    } else {
      console.log('\n⚠️  未生成 Linux 图标');
      console.log('  ℹ️  安装 ImageMagick 以生成图标: sudo apt-get install imagemagick');
      console.log('  ℹ️  electron-builder 会使用默认图标\n');
    }
  }

  console.log('✅ 图标生成完成!');
  console.log('');

} catch (error) {
  console.error('\n❌ 图标生成失败:', error.message);
  console.log('');
  console.log('💡 提示: electron-builder 会在构建时自动生成必要的图标');
  console.log('   所以这个脚本主要是为了在开发时预览图标\n');
  process.exit(0); // 不退出，让构建继续
}
