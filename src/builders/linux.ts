import * as path from 'path';
import { BuildResult } from '../types.js';
import { logger } from '../logger.js';
import { BaseBuilder } from './base.js';

export class LinuxBuilder extends BaseBuilder {
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const { platform } = this.config;
    
    logger.info(`Building Datadog Agent for Linux ${platform.arch}...`);
    
    try {
      await this.ensureOutputDirectory();
      
      // Check if we need to use Docker for cross-compilation
      const hostPlatform = process.platform;
      if (hostPlatform !== 'linux' && await this.isDockerAvailable()) {
        logger.info('Using Docker for cross-compilation...');
        return await this.buildWithDocker(startTime, 'Dockerfile.linux', 'docker-build.sh');
      }
      
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
    
    let command = `go build -tags "netgo linux_bpf" -ldflags "-s -w" -o "${outputPath}" ./cmd/system-probe`;
    
    if (arch === 'arm64') {
      command = `GOARCH=arm64 ${command}`;
    }
    
    await this.executeCommand(command);
  }

  protected getBuildTags(): string[] {
    const tags = ['netgo'];
    
    // For cross-compilation from macOS, use simpler build tags and exclude problematic components
    const hostPlatform = process.platform;
    if (hostPlatform === 'darwin') {
      // Exclude components that have build conflicts when CGO is disabled
      tags.push('!ebpf');
      return tags;
    }
    
    // Native Linux build can use all tags
    tags.push('static_build');
    return tags;
  }

  protected createDockerBuildScript(): string {
    const { arch } = this.config.platform;
    const version = this.config.version || '7.66.1';
    const buildDate = new Date().toISOString();
    
    return `#!/bin/bash
set -e

echo "Setting up build environment..."
export CGO_ENABLED=1
export GOOS=linux
export GOARCH=${arch === 'x64' ? 'amd64' : 'arm64'}

# Set up cross-compilation environment based on target architecture
HOST_ARCH=$(uname -m)
TARGET_ARCH="${arch === 'x64' ? 'amd64' : 'arm64'}"

if [ "$HOST_ARCH" = "x86_64" ] && [ "$TARGET_ARCH" = "arm64" ]; then
    # Cross-compiling from amd64 to arm64
    export CC=aarch64-linux-gnu-gcc
    export CXX=aarch64-linux-gnu-g++
    echo "Cross-compiling from amd64 to arm64"
elif [ "$HOST_ARCH" = "aarch64" ] && [ "$TARGET_ARCH" = "amd64" ]; then
    # Cross-compiling from arm64 to amd64
    export CC=x86_64-linux-gnu-gcc
    export CXX=x86_64-linux-gnu-g++
    echo "Cross-compiling from arm64 to amd64"
else
    # Native compilation
    export CC=gcc
    export CXX=g++
    echo "Native compilation for $TARGET_ARCH"
fi

echo "Installing Go dependencies..."
go mod download

echo "Building agent binary..."
mkdir -p build

# Get version information
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_VERSION=$(git describe --tags --always 2>/dev/null || echo "${version}")

# Build main agent
go build -tags "netgo static_build" \\
  -ldflags "-s -w -X github.com/DataDog/datadog-agent/pkg/version.AgentVersion=\${GIT_VERSION} -X github.com/DataDog/datadog-agent/pkg/version.Commit=\${GIT_COMMIT} -X github.com/DataDog/datadog-agent/pkg/version.BuildDate=${buildDate}" \\
  -o "build/datadog-agent" ./cmd/agent

echo "Building other components..."

# Build process agent
go build -ldflags "-s -w" -o "build/process-agent" ./cmd/process-agent

# Build trace agent  
go build -ldflags "-s -w" -o "build/trace-agent" ./cmd/trace-agent

# Build system probe
go build -tags "netgo static_build" -ldflags "-s -w" -o "build/system-probe" ./cmd/system-probe

echo "Copying binaries to output directory..."
mkdir -p /workspace/output
cp build/* /workspace/output/

echo "Build completed successfully!"
`;
  }

  protected getEnvironmentVariables(): Record<string, string> {
    const env = super.getEnvironmentVariables();
    
    // For cross-compilation from macOS to Linux, we need to disable CGO
    // or set up a proper cross-compilation toolchain
    const hostPlatform = process.platform;
    if (hostPlatform === 'darwin') {
      // Disable CGO for cross-compilation from macOS to Linux
      // The Datadog Agent can build without CGO for most components
      env.CGO_ENABLED = '0';
    }
    
    return env;
  }
}