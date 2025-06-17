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

echo "Installing build tools..."
pip install dda

echo "Installing Go tools..."
dda inv install-tools

echo "Building agent..."
dda inv agent.build --build-exclude=systemd

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