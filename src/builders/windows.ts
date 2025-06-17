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
    
    return `#!/bin/bash
set -e

echo "Setting up build environment..."
export CGO_ENABLED=1
export GOOS=windows
export GOARCH=${arch === 'x64' ? 'amd64' : 'arm64'}

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