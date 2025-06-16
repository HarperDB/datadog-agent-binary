#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { DatadogAgentBuilder, BinaryManager } from './index.js';
import { getAllSupportedPlatforms, detectPlatform, validatePlatform } from './platform.js';
import { logger } from './logger.js';
import { Platform } from './types.js';

const program = new Command();

program
  .name('datadog-agent-build')
  .description('Build Datadog Agent from source for multiple platforms')
  .version('1.0.0');

program
  .command('build')
  .description('Build Datadog Agent for specified platform(s)')
  .option('-p, --platform <platform>', 'Target platform (os-arch, e.g., linux-x64)')
  .option('-a, --all', 'Build for all supported platforms')
  .option('-v, --version <version>', 'Datadog Agent version to build')
  .option('-o, --output <dir>', 'Output directory', './build')
  .option('-s, --source <dir>', 'Source directory (if already downloaded)')
  .option('--build-args <args>', 'Additional build arguments')
  .option('-d, --debug', 'Enable debug logging')
  .action(async (options) => {
    if (options.debug) {
      process.env.DEBUG = '1';
    }

    const builder = new DatadogAgentBuilder();

    try {
      let results;

      if (options.all) {
        logger.info('Building for all supported platforms...');
        // For --all builds, let the library handle platform-specific subdirs
        results = await builder.buildForAllPlatforms({
          version: options.version,
          sourceDir: options.source,
          buildArgs: options.buildArgs?.split(' ')
        });
      } else if (options.platform) {
        const [os, arch] = options.platform.split('-');
        const platform: Platform = { os: os as any, arch: arch as any };
        
        validatePlatform(platform);
        
        logger.info(`Building for ${options.platform}...`);
        const outputDir = path.join(options.output, `${os}-${arch}`);
        const result = await builder.buildForPlatform(platform, {
          version: options.version,
          outputDir,
          sourceDir: options.source,
          buildArgs: options.buildArgs?.split(' ')
        });
        results = [result];
      } else {
        logger.info('Building for current platform...');
        const currentPlatform = detectPlatform();
        const outputDir = path.join(options.output, `${currentPlatform.os}-${currentPlatform.arch}`);
        const result = await builder.buildForCurrentPlatform({
          version: options.version,
          outputDir,
          sourceDir: options.source,
          buildArgs: options.buildArgs?.split(' ')
        });
        results = [result];
      }

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Add cross-compilation warning for failed builds
      const hostPlatform = detectPlatform();
      
      for (const failedResult of failed) {
        const targetPlatform = failedResult.platform;
        if (hostPlatform.os !== targetPlatform.os) {
          logger.warn(`Cross-compilation from ${hostPlatform.os} to ${targetPlatform.os} may require additional setup.`);
          logger.warn(`For best results, build ${targetPlatform.os} binaries on a native ${targetPlatform.os} system.`);
        }
      }

      logger.info(`\nBuild Summary:`);
      logger.info(`✅ Successful: ${successful.length}`);
      if (failed.length > 0) {
        logger.error(`❌ Failed: ${failed.length}`);
        for (const result of failed) {
          logger.error(`   ${result.platform.os}-${result.platform.arch}: ${result.error}`);
        }
      }

      if (successful.length > 0) {
        logger.info(`\nOutputs:`);
        for (const result of successful) {
          logger.info(`   ${result.platform.os}-${result.platform.arch}: ${result.outputPath}`);
        }
      }

      process.exit(failed.length > 0 ? 1 : 0);

    } catch (error: any) {
      logger.error(`Build failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('platforms')
  .description('List all supported platforms')
  .action(() => {
    const platforms = getAllSupportedPlatforms();
    const current = detectPlatform();
    
    logger.info('Supported platforms:');
    for (const platform of platforms) {
      const isCurrent = platform.os === current.os && platform.arch === current.arch;
      const marker = isCurrent ? ' (current)' : '';
      logger.info(`  ${platform.os}-${platform.arch}${marker}`);
    }
  });

program
  .command('version')
  .description('Show latest Datadog Agent version')
  .action(async () => {
    try {
      const builder = new DatadogAgentBuilder();
      const version = await builder['downloader'].getLatestVersion();
      logger.info(`Latest Datadog Agent version: ${version}`);
    } catch (error: any) {
      logger.error(`Failed to fetch version: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('install')
  .description('Install Datadog Agent binary for current platform')
  .option('-v, --version <version>', 'Specific version to install')
  .option('-f, --force', 'Force reinstall even if already installed')
  .action(async (options) => {
    try {
      const manager = new BinaryManager();
      
      if (options.force) {
        logger.info('Force reinstall requested...');
      }
      
      const binaryPath = await manager.ensureBinary(options.version);
      logger.info(`✅ Datadog Agent installed: ${binaryPath}`);
      logger.info('Run with: datadog-agent <command>');
      
    } catch (error: any) {
      logger.error(`Installation failed: ${error.message}`);
      logger.info('You can build from source using: datadog-agent-build build');
      process.exit(1);
    }
  });

program.parse();