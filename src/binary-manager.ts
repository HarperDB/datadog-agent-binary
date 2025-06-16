import * as fs from "fs/promises";
import * as path from "path";
import fetch from "node-fetch";
import { detectPlatform, getPlatformString } from "./platform.js";
import { logger } from "./logger.js";
import { Platform } from "./types.js";

export interface BinaryInfo {
  version: string;
  platform: Platform;
  downloadUrl: string;
  fileName: string;
  checksum?: string;
}

export class BinaryManager {
  private readonly binDir: string;

  constructor() {
    this.binDir = path.join(__dirname, "..", "bin");
  }

  async ensureBinary(version?: string): Promise<string> {
    const platform = detectPlatform();

    // First try to use optional dependency package
    const optionalBinaryPath = await this.tryOptionalDependency(platform);
    if (optionalBinaryPath) {
      return optionalBinaryPath;
    }

    // Fallback to download/build
    const targetVersion = version || (await this.getLatestVersion());
    const binaryPath = await this.getBinaryPath(platform, targetVersion);

    if (await this.binaryExists(binaryPath)) {
      logger.debug(`Binary already exists: ${binaryPath}`);
      return binaryPath;
    }

    logger.info(
      `Downloading Datadog Agent binary for ${getPlatformString(platform)}...`,
    );
    return await this.downloadBinary(platform, targetVersion);
  }

  private async tryOptionalDependency(
    platform: Platform,
  ): Promise<string | null> {
    try {
      const platformString = getPlatformString(platform);
      const packageName = `@datadog-agent-binary/${platformString}`;

      // Try to require the optional dependency
      const binaryPackage = require(packageName);
      const binaryPath = binaryPackage.getBinaryPath();

      if (await this.binaryExists(binaryPath)) {
        logger.info(`Using platform-specific binary package: ${packageName}`);
        return binaryPath;
      }
    } catch (error) {
      // Optional dependency not available, continue with fallback
      logger.debug(`Optional dependency not available: ${error}`);
    }

    return null;
  }

  private async getBinaryPath(
    platform: Platform,
    version: string,
  ): Promise<string> {
    const fileName = this.getBinaryFileName(platform);
    return path.join(
      this.binDir,
      `${version}-${getPlatformString(platform)}`,
      fileName,
    );
  }

  private getBinaryFileName(platform: Platform): string {
    const baseName = "datadog-agent";
    return platform.os === "windows" ? `${baseName}.exe` : baseName;
  }

  private async binaryExists(binaryPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(binaryPath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async getLatestVersion(): Promise<string> {
    const response = await fetch(
      "https://api.github.com/repos/DataDog/datadog-agent/releases/latest",
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch latest version: ${response.statusText}`);
    }

    const data = (await response.json()) as { tag_name: string };
    return data.tag_name;
  }

  private async downloadBinary(
    platform: Platform,
    version: string,
  ): Promise<string> {
    const binaryInfo = await this.getBinaryInfo(platform, version);
    const platformDir = path.join(
      this.binDir,
      `${version}-${getPlatformString(platform)}`,
    );

    await fs.mkdir(platformDir, { recursive: true });

    logger.info(`Downloading from: ${binaryInfo.downloadUrl}`);

    const response = await fetch(binaryInfo.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download binary: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tarPath = path.join(platformDir, binaryInfo.fileName);
    await fs.writeFile(tarPath, buffer);

    // Extract the tarball
    const tar = await import("tar");
    await tar.extract({
      file: tarPath,
      cwd: platformDir,
      strip: 1,
    });

    // Remove the tarball
    await fs.unlink(tarPath);

    // Find the main binary
    const binaryPath = await this.getBinaryPath(platform, version);

    // Make executable on Unix systems
    if (platform.os !== "windows") {
      await fs.chmod(binaryPath, 0o755);
    }

    logger.info(`Binary installed: ${binaryPath}`);
    return binaryPath;
  }

  private async getBinaryInfo(
    platform: Platform,
    version: string,
  ): Promise<BinaryInfo> {
    const platformString = getPlatformString(platform);
    const fileName = `datadog-agent-${version}-${platformString}.tar.gz`;

    // Download from this package's GitHub releases
    const downloadUrl = `https://github.com/your-org/datadog-agent-binary/releases/download/v${version}/${fileName}`;

    return {
      version,
      platform,
      downloadUrl,
      fileName,
    };
  }

  async createBinaryWrapper(): Promise<void> {
    const wrapperPath = path.join(this.binDir, "datadog-agent");
    const platform = detectPlatform();

    let wrapperContent: string;

    if (platform.os === "windows") {
      wrapperContent = this.createWindowsWrapper();
      await fs.writeFile(wrapperPath + ".cmd", wrapperContent);
    } else {
      wrapperContent = this.createUnixWrapper();
      await fs.writeFile(wrapperPath, wrapperContent);
      await fs.chmod(wrapperPath, 0o755);
    }

    logger.debug(`Created binary wrapper: ${wrapperPath}`);
  }

  private createUnixWrapper(): string {
    return `#!/usr/bin/env node

const { BinaryManager } = require('../dist/binary-manager.js');
const { spawn } = require('child_process');
const path = require('path');

async function main() {
  try {
    const manager = new BinaryManager();
    const binaryPath = await manager.ensureBinary();

    const child = spawn(binaryPath, process.argv.slice(2), {
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

  } catch (error) {
    console.error('Failed to run datadog-agent:', error.message);
    process.exit(1);
  }
}

main();
`;
  }

  private createWindowsWrapper(): string {
    return `@echo off
node "%~dp0\\..\\dist\\binary-manager.js" %*
`;
  }

  async installForCurrentPlatform(): Promise<void> {
    const platform = detectPlatform();
    logger.info(
      `Installing Datadog Agent binary for ${getPlatformString(platform)}...`,
    );

    try {
      await this.ensureBinary();
      await this.createBinaryWrapper();
      logger.info("Installation completed successfully");
    } catch (error: any) {
      logger.error(`Installation failed: ${error.message}`);
      logger.warn("Falling back to build-from-source mode");
      throw error;
    }
  }
}
