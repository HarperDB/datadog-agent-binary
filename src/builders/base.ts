import { execSync } from "child_process";
import * as path from "path";
import { BuildConfig, BuildResult } from "../types.js";
import { logger } from "../logger.js";

export abstract class BaseBuilder {
  protected config: BuildConfig;

  constructor(config: BuildConfig) {
    this.config = config;
  }

  abstract build(): Promise<BuildResult>;

  protected async buildCommon(): Promise<void> {
    logger.info("Installing build tools...");
    await this.executeCommand("pip install dda");

    logger.info("Installing Go tools...");
    await this.executeCommand("dda --no-interactive inv install-tools");

    logger.info("Building agent...");
    await this.executeCommand(
      "dda --no-interactive inv agent.build --build-exclude=systemd",
    );
  }

  protected async executeCommand(
    command: string,
    cwd?: string,
  ): Promise<string> {
    logger.debug(`Executing: ${command}`);

    try {
      const workingDir = cwd || this.config.sourceDir;

      const result = execSync(command, {
        cwd: workingDir,
        encoding: "utf8",
        stdio: ["inherit", "pipe", "inherit"], // stdin inherit, stdout pipe, stderr inherit
        timeout: 120000, // Default 2 minute timeout
        env: {
          ...process.env,
          ...this.getEnvironmentVariables(),
        },
      });

      return result.toString();
    } catch (error: any) {
      logger.error(`Command failed: ${command}`);
      logger.error(`Error: ${error.message}`);
      throw error;
    }
  }

  protected getEnvironmentVariables(): Record<string, string> {
    const { platform } = this.config;
    const env: Record<string, string> = {};

    // Set GOPATH to our project directory to work with mise
    const projectGoPath = path.join(process.cwd(), "go");
    env.GOPATH = projectGoPath;

    switch (platform.arch) {
      case "arm64":
        env.GOARCH = "arm64";
        break;
      case "x64":
        env.GOARCH = "amd64";
        break;
    }

    switch (platform.os) {
      case "linux":
        env.GOOS = "linux";
        env.CGO_ENABLED = "1";
        break;
      case "darwin":
        env.GOOS = "darwin";
        env.CGO_ENABLED = "1";
        break;
      case "windows":
        env.GOOS = "windows";
        env.CGO_ENABLED = "1";
        break;
    }

    return env;
  }

  protected getOutputBinaryName(): string {
    const { platform } = this.config;
    const baseName = "datadog-agent";

    if (platform.os === "windows") {
      return `${baseName}.exe`;
    }

    return baseName;
  }

  protected async ensureOutputDirectory(): Promise<void> {
    const { mkdir } = await import("fs/promises");
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
    const { copyFile, mkdir } = await import("fs/promises");

    // Ensure output directory exists
    const absoluteOutputDir = path.isAbsolute(this.config.outputDir)
      ? this.config.outputDir
      : path.join(process.cwd(), this.config.outputDir);

    await mkdir(absoluteOutputDir, { recursive: true });

    // List of binaries to copy
    const binaries = [
      this.getOutputBinaryName(),
      "process-agent" + (this.config.platform.os === "windows" ? ".exe" : ""),
      "trace-agent" + (this.config.platform.os === "windows" ? ".exe" : ""),
      "system-probe" + (this.config.platform.os === "windows" ? ".exe" : ""),
    ];

    for (const binary of binaries) {
      const sourcePath = path.join(this.config.sourceDir, "build", binary);
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


}
