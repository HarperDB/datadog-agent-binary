import { execSync } from 'child_process';
import * as path from 'path';
import { BuildConfig, BuildResult } from '../types.js';
import { logger } from '../logger.js';

export abstract class BaseBuilder {
  protected config: BuildConfig;

  constructor(config: BuildConfig) {
    this.config = config;
  }

  abstract build(): Promise<BuildResult>;

  protected async executeCommand(command: string, cwd?: string): Promise<string> {
    logger.debug(`Executing: ${command}`);
    
    try {
      const workingDir = cwd || this.config.sourceDir;
      
      // Check for and handle go.work file issues
      await this.handleGoWorkspaceIssues(workingDir);
      
      const result = execSync(command, {
        cwd: workingDir,
        encoding: 'utf8',
        stdio: 'pipe',
        env: {
          ...process.env,
          ...this.getEnvironmentVariables()
        }
      });
      
      return result.toString();
    } catch (error: any) {
      logger.error(`Command failed: ${command}`);
      logger.error(`Error: ${error.message}`);
      throw error;
    }
  }

  private async handleGoWorkspaceIssues(workingDir: string): Promise<void> {
    const { access, readFile, writeFile } = await import('fs/promises');
    const path = await import('path');
    
    const goWorkPath = path.join(workingDir, 'go.work');
    
    try {
      await access(goWorkPath);
      
      // Read the go.work file
      let content = await readFile(goWorkPath, 'utf8');
      
      // Remove problematic godebug directives that are not supported in older Go versions
      const problematicDirectives = ['tlskyber', 'tls13keys'];
      let modified = false;
      
      for (const directive of problematicDirectives) {
        const regex = new RegExp(`^godebug\\s+${directive}\\s*=.*$`, 'gm');
        if (regex.test(content)) {
          content = content.replace(regex, '');
          modified = true;
          logger.debug(`Removed unsupported godebug directive: ${directive}`);
        }
      }
      
      // Clean up empty lines
      if (modified) {
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        await writeFile(goWorkPath, content);
        logger.debug('Updated go.work file to remove unsupported directives');
      }
      
    } catch (error) {
      // go.work file doesn't exist or can't be read - that's okay
      logger.debug('No go.work file found or unable to read it');
    }
  }

  protected getEnvironmentVariables(): Record<string, string> {
    const { platform } = this.config;
    const env: Record<string, string> = {};

    switch (platform.arch) {
      case 'arm64':
        env.GOARCH = 'arm64';
        break;
      case 'x64':
        env.GOARCH = 'amd64';
        break;
    }

    switch (platform.os) {
      case 'linux':
        env.GOOS = 'linux';
        env.CGO_ENABLED = '1';
        break;
      case 'darwin':
        env.GOOS = 'darwin';
        env.CGO_ENABLED = '1';
        break;
      case 'windows':
        env.GOOS = 'windows';
        env.CGO_ENABLED = '1';
        break;
    }

    return env;
  }

  protected getOutputBinaryName(): string {
    const { platform } = this.config;
    const baseName = 'datadog-agent';
    
    if (platform.os === 'windows') {
      return `${baseName}.exe`;
    }
    
    return baseName;
  }

  protected getBuildTags(): string[] {
    const tags = ['netgo'];
    
    if (this.config.platform.os === 'linux') {
      tags.push('static_build');
    }
    
    return tags;
  }

  protected async ensureOutputDirectory(): Promise<void> {
    const { mkdir } = await import('fs/promises');
    await mkdir(this.config.outputDir, { recursive: true });
  }

  protected getAbsoluteOutputPath(fileName: string): string {
    // Ensure output path is absolute and not relative to source directory
    if (path.isAbsolute(this.config.outputDir)) {
      return path.join(this.config.outputDir, fileName);
    } else {
      // If outputDir is relative, resolve it from the current working directory (project root)
      const projectRoot = process.cwd();
      return path.join(projectRoot, this.config.outputDir, fileName);
    }
  }

  protected async copyBinariesToOutput(): Promise<void> {
    const { copyFile, mkdir } = await import('fs/promises');
    
    // Ensure output directory exists
    const absoluteOutputDir = path.isAbsolute(this.config.outputDir) 
      ? this.config.outputDir 
      : path.join(process.cwd(), this.config.outputDir);
    
    await mkdir(absoluteOutputDir, { recursive: true });
    
    // List of binaries to copy
    const binaries = [
      this.getOutputBinaryName(),
      'process-agent' + (this.config.platform.os === 'windows' ? '.exe' : ''),
      'trace-agent' + (this.config.platform.os === 'windows' ? '.exe' : ''),
      'system-probe' + (this.config.platform.os === 'windows' ? '.exe' : '')
    ];
    
    for (const binary of binaries) {
      const sourcePath = path.join(this.config.sourceDir, 'build', binary);
      const destPath = path.join(absoluteOutputDir, binary);
      
      try {
        await copyFile(sourcePath, destPath);
        logger.debug(`Copied ${binary} to output directory`);
      } catch (error: any) {
        logger.debug(`Failed to copy ${binary}: ${error.message}`);
        // Don't fail the build if some binaries don't exist
      }
    }
  }

  protected async isDockerAvailable(): Promise<boolean> {
    try {
      await this.executeCommand('docker --version', process.cwd());
      return true;
    } catch {
      return false;
    }
  }

  protected async buildWithDocker(startTime: number, dockerfileName: string, buildScriptName: string): Promise<BuildResult> {
    const { platform } = this.config;
    
    try {
      // Build Docker image
      logger.info(`Building Docker image for ${platform.os} compilation...`);
      const dockerfilePath = path.join(process.cwd(), dockerfileName);
      const imageName = `datadog-agent-builder:${platform.os}`;
      await this.executeCommand(`docker build -f ${dockerfilePath} -t ${imageName} .`, process.cwd());
      
      // Prepare Docker run command
      const sourceMount = `${this.config.sourceDir}:/workspace/source`;
      const outputMount = `${this.getAbsoluteOutputPath('')}:/workspace/output`;
      
      // Create build script for Docker
      const buildScript = this.createDockerBuildScript();
      const buildScriptPath = path.join(this.config.sourceDir, buildScriptName);
      await this.writeBuildScript(buildScriptPath, buildScript);
      
      // Run build in Docker
      logger.info('Running build in Docker container...');
      const dockerCmd = [
        'docker run --rm',
        `-v "${sourceMount}"`,
        `-v "${outputMount}"`,
        '-w /workspace/source',
        imageName,
        `bash ${buildScriptName}`
      ].join(' ');
      
      await this.executeCommand(dockerCmd, process.cwd());
      
      const outputPath = this.getAbsoluteOutputPath(this.getOutputBinaryName());
      const duration = Date.now() - startTime;
      
      logger.info(`Docker build completed successfully in ${duration}ms`);
      logger.info(`Output: ${outputPath}`);
      
      return {
        success: true,
        platform,
        outputPath,
        duration
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Docker build failed: ${error.message}`);
      
      return {
        success: false,
        platform,
        error: error.message,
        duration
      };
    }
  }

  protected abstract createDockerBuildScript(): string;

  protected async writeBuildScript(filePath: string, content: string): Promise<void> {
    const { writeFile, chmod } = await import('fs/promises');
    await writeFile(filePath, content);
    await chmod(filePath, 0o755);
  }
}