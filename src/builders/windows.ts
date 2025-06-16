import * as path from 'path';
import { BuildResult } from '../types.js';
import { logger } from '../logger.js';
import { BaseBuilder } from './base.js';

export class WindowsBuilder extends BaseBuilder {
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const { platform } = this.config;
    
    logger.info(`Building Datadog Agent for Windows ${platform.arch}...`);
    
    try {
      await this.ensureOutputDirectory();
      
      // Check if we need to use Docker for cross-compilation
      const hostPlatform = process.platform;
      if (hostPlatform !== 'win32' && await this.isDockerAvailable()) {
        logger.info('Using Docker for cross-compilation...');
        return await this.buildWithDocker(startTime, 'Dockerfile.windows', 'docker-build-windows.sh');
      }
      
      logger.info('Installing Go dependencies...');
      await this.executeCommand('go mod download');
      
      logger.info('Building agent binary...');
      await this.buildAgent();
      
      logger.info('Building other components...');
      await this.buildProcessAgent();
      await this.buildTraceAgent();
      
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

  private getWindowsBuildTags(): string[] {
    // Official Windows build tags based on Datadog's build system
    // Excluding 'python' tag since we're not building rtloader for cross-compilation
    return ['bundle_installer', 'consul', 'containerd', 'no_dynamic_plugins', 'cri', 'crio', 'datadog.no_waf', 'docker', 'ec2', 'etcd', 'grpcnotrace', 'jmx', 'kubeapiserver', 'kubelet', 'oracle', 'orchestrator', 'otlp', 'wmi', 'zlib', 'zstd'];
  }

  private async buildAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const buildTags = this.getWindowsBuildTags();
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
      '-H windowsgui',
      `-X github.com/DataDog/datadog-agent/pkg/version.AgentVersion=${gitVersion}`,
      `-X github.com/DataDog/datadog-agent/pkg/version.Commit=${gitCommit}`,
      `-X github.com/DataDog/datadog-agent/pkg/version.BuildDate=${buildDate}`
    ].join(' ');
    
    let command = `go build -tags "${buildTags.join(' ')}" -ldflags "${ldflags}" -o "${outputPath}" ./cmd/agent`;
    
    if (arch === 'arm64') {
      command = `set GOARCH=arm64 && ${command}`;
    }
    
    await this.executeCommand(command);
  }

  private async buildProcessAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const outputPath = path.join('build', 'process-agent.exe');
    
    let command = `go build -ldflags "-s -w" -o "${outputPath}" ./cmd/process-agent`;
    
    if (arch === 'arm64') {
      command = `set GOARCH=arm64 && ${command}`;
    }
    
    await this.executeCommand(command);
  }

  private async buildTraceAgent(): Promise<void> {
    const { arch } = this.config.platform;
    const outputPath = path.join('build', 'trace-agent.exe');
    
    let command = `go build -ldflags "-s -w" -o "${outputPath}" ./cmd/trace-agent`;
    
    if (arch === 'arm64') {
      command = `set GOARCH=arm64 && ${command}`;
    }
    
    await this.executeCommand(command);
  }

  protected createDockerBuildScript(): string {
    const { arch } = this.config.platform;
    const version = this.config.version || '7.66.1';
    const buildDate = new Date().toISOString();
    const buildTags = this.getWindowsBuildTags().join(',');
    
    return `#!/bin/bash
set -e

echo "Setting up build environment..."
export CGO_ENABLED=1
export GOOS=windows
export GOARCH=${arch === 'x64' ? 'amd64' : 'arm64'}
export DD_CROSS_COMPILE=1

# Set up MinGW cross-compilation environment
if [ "${arch}" = "x64" ]; then
    export CC=x86_64-w64-mingw32-gcc
    export CXX=x86_64-w64-mingw32-g++
    echo "Cross-compiling for Windows amd64"
else
    export CC=aarch64-w64-mingw32-gcc
    export CXX=aarch64-w64-mingw32-g++
    echo "Cross-compiling for Windows arm64"
fi

echo "Installing Go dependencies..."
go mod download

echo "Skipping rtloader build for now..."
# TODO: Build the Python runtime loader for Windows
# This requires proper cross-compilation setup for CMake/MinGW

echo "Building Windows message table..."
# Generate messagestrings.h from messagestrings.mc
# Note: Using x86_64 windmc for both x64 and ARM64 since it only generates headers
cd pkg/util/winutil/messagestrings
x86_64-w64-mingw32-windmc messagestrings.mc
cd /workspace/source

echo "Building agent binary..."
mkdir -p build

# Get version information
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_VERSION=$(git describe --tags --always 2>/dev/null || echo "${version}")

# Build main agent (using official Windows build tags)
go build -tags "${buildTags}" \\
  -ldflags "-s -w -H windowsgui -X github.com/DataDog/datadog-agent/pkg/version.AgentVersion=\${GIT_VERSION} -X github.com/DataDog/datadog-agent/pkg/version.Commit=\${GIT_COMMIT} -X github.com/DataDog/datadog-agent/pkg/version.BuildDate=${buildDate}" \\
  -o "build/datadog-agent.exe" ./cmd/agent

echo "Building other components..."

# Build process agent (with minimal features for cross-compilation)
go build -tags "!sbom" -ldflags "-s -w" -o "build/process-agent.exe" ./cmd/process-agent

# Build trace agent (minimal dependencies)
go build -ldflags "-s -w" -o "build/trace-agent.exe" ./cmd/trace-agent

echo "Copying binaries to output directory..."
mkdir -p /workspace/output
cp build/* /workspace/output/

echo "Build completed successfully!"
`;
  }

  protected getEnvironmentVariables(): Record<string, string> {
    const env = super.getEnvironmentVariables();
    
    // For cross-compilation from macOS to Windows, disable CGO
    const hostPlatform = process.platform;
    if (hostPlatform === 'darwin') {
      env.CGO_ENABLED = '0';
    } else {
      env.CC = 'gcc';
      env.CXX = 'g++';
      
      if (this.config.platform.arch === 'arm64') {
        env.CC = 'aarch64-w64-mingw32-gcc';
        env.CXX = 'aarch64-w64-mingw32-g++';
      } else {
        env.CC = 'x86_64-w64-mingw32-gcc';
        env.CXX = 'x86_64-w64-mingw32-g++';
      }
    }
    
    return env;
  }
}