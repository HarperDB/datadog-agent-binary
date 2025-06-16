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
      
      logger.info('Installing Go dependencies...');
      await this.executeCommand('go mod download');
      
      logger.info('Building agent binary...');
      await this.buildAgent();
      
      logger.info('Building other components...');
      await this.buildProcessAgent();
      await this.buildTraceAgent();
      await this.buildSystemProbe();
      
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

  private async buildAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const buildTags = this.getBuildTags();
    const outputPath = path.join('build', this.getOutputBinaryName());
    
    // Get version information
    const version = this.config.version || '7.66.1';
    const buildDate = new Date().toISOString();
    
    let gitCommit = 'unknown';
    let gitVersion = version;
    
    try {
      gitCommit = await this.executeCommand('git rev-parse HEAD');
      gitCommit = gitCommit.trim();
      gitVersion = await this.executeCommand('git describe --tags --always');
      gitVersion = gitVersion.trim();
    } catch {
      // Use fallback values if git commands fail
      logger.debug('Git commands failed, using fallback version info');
    }
    
    const ldflags = [
      '-s',
      '-w',
      `-X github.com/DataDog/datadog-agent/pkg/version.AgentVersion=${gitVersion}`,
      `-X github.com/DataDog/datadog-agent/pkg/version.Commit=${gitCommit}`,
      `-X github.com/DataDog/datadog-agent/pkg/version.BuildDate=${buildDate}`
    ].join(' ');
    
    let command = `go build -tags "${buildTags.join(' ')}" -ldflags "${ldflags}" -o "${outputPath}" ./cmd/agent`;
    
    if (arch === 'arm64') {
      command = `GOARCH=arm64 ${command}`;
    }
    
    await this.executeCommand(command);
  }

  private async buildProcessAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const outputPath = path.join('build', 'process-agent');
    
    let command = `go build -ldflags "-s -w" -o "${outputPath}" ./cmd/process-agent`;
    
    if (arch === 'arm64') {
      command = `GOARCH=arm64 ${command}`;
    }
    
    await this.executeCommand(command);
  }

  private async buildTraceAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const outputPath = path.join('build', 'trace-agent');
    
    let command = `go build -ldflags "-s -w" -o "${outputPath}" ./cmd/trace-agent`;
    
    if (arch === 'arm64') {
      command = `GOARCH=arm64 ${command}`;
    }
    
    await this.executeCommand(command);
  }

  private async buildSystemProbe(): Promise<void> {
    const { arch } = this.config.platform;
    const outputPath = path.join('build', 'system-probe');
    
    let command = `go build -tags "netgo" -ldflags "-s -w" -o "${outputPath}" ./cmd/system-probe`;
    
    if (arch === 'arm64') {
      command = `GOARCH=arm64 ${command}`;
    }
    
    await this.executeCommand(command);
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