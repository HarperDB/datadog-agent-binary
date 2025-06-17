import * as path from 'path';
import { BuildResult } from '../types.js';
import { logger } from '../logger.js';
import { BaseBuilder } from './base.js';

export class DarwinBuilder extends BaseBuilder {
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const { platform } = this.config;
    
    logger.info(`Building Datadog Agent for macOS ${platform.arch}...`);
    
    try {
      await this.ensureOutputDirectory();
      await this.checkXcodeTools();
      
      await this.buildCommon();
      
      logger.info('Copying binaries to output directory...');
      await this.copyBinariesToOutput();
      
      const outputPath = this.getAbsoluteOutputPath(this.getOutputBinaryName());
      const duration = Date.now() - startTime;
      
      logger.info(`Build completed successfully in ${duration}ms`);
      logger.info(`Output: ${outputPath}`);
      
      return {
        success: true,
        platform,
        outputPath,
        duration
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Build failed: ${error.message}`);
      
      return {
        success: false,
        platform,
        error: error.message,
        duration
      };
    }
  }

  private async checkXcodeTools(): Promise<void> {
    try {
      await this.executeCommand('xcode-select -p');
      logger.debug('Xcode command line tools found');
    } catch {
      throw new Error('Xcode command line tools not found. Run: xcode-select --install');
    }
  }


  protected createDockerBuildScript(): string {
    // Darwin builds don't use Docker since they run natively on macOS
    throw new Error('Docker builds not supported for Darwin platform');
  }

  protected getEnvironmentVariables(): Record<string, string> {
    const env = super.getEnvironmentVariables();
    
    if (this.config.platform.arch === 'arm64') {
      env.CC = 'clang';
      env.CXX = 'clang++';
      env.CGO_CFLAGS = '-arch arm64';
      env.CGO_LDFLAGS = '-arch arm64';
    } else {
      env.CC = 'clang';
      env.CXX = 'clang++';
      env.CGO_CFLAGS = '-arch x86_64';
      env.CGO_LDFLAGS = '-arch x86_64';
    }
    
    return env;
  }
}