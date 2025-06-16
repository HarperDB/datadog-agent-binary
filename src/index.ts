import * as path from "path";
import { DatadogAgentDownloader } from "./downloader.js";
import { createBuilder } from "./builders/index.js";
import {
  detectPlatform,
  getAllSupportedPlatforms,
  validatePlatform,
} from "./platform.js";
import { logger } from "./logger.js";
import { BuildConfig, Platform, BuildResult } from "./types.js";

export class DatadogAgentBuilder {
  private downloader: DatadogAgentDownloader;

  constructor() {
    this.downloader = new DatadogAgentDownloader();
  }

  getLatestVersion(): Promise<string> {
    return this.downloader.getLatestVersion();
  }

  async buildForPlatform(
    platform: Platform,
    options: {
      version?: string;
      outputDir?: string;
      sourceDir?: string;
      buildArgs?: string[];
    } = {},
  ): Promise<BuildResult> {
    validatePlatform(platform);

    const version =
      options.version || (await this.downloader.getLatestVersion());
    const outputDir =
      options.outputDir ||
      path.join(process.cwd(), "build", `${platform.os}-${platform.arch}`);
    const sourceDir = options.sourceDir || path.join(process.cwd(), "source");

    logger.info(
      `Building Datadog Agent ${version} for ${platform.os}-${platform.arch}`,
    );

    if (!options.sourceDir) {
      await this.downloader.downloadSource({
        version,
        platform,
        outputDir: path.dirname(sourceDir),
      });
    }

    await this.downloader.checkBuildDependencies(platform);

    const config: BuildConfig = {
      platform,
      version,
      outputDir,
      sourceDir,
      buildArgs: options.buildArgs,
    };

    const builder = createBuilder(config);
    return await builder.build();
  }

  async buildForAllPlatforms(
    options: {
      version?: string;
      outputDir?: string;
      sourceDir?: string;
      buildArgs?: string[];
    } = {},
  ): Promise<BuildResult[]> {
    const platforms = getAllSupportedPlatforms();
    const results: BuildResult[] = [];

    for (const platform of platforms) {
      try {
        const result = await this.buildForPlatform(platform, options);
        results.push(result);
      } catch (error: any) {
        logger.error(
          `Failed to build for ${platform.os}-${platform.arch}: ${error.message}`,
        );
        results.push({
          success: false,
          platform,
          error: error.message,
          duration: 0,
        });
      }
    }

    return results;
  }

  async buildForCurrentPlatform(
    options: {
      version?: string;
      outputDir?: string;
      sourceDir?: string;
      buildArgs?: string[];
    } = {},
  ): Promise<BuildResult> {
    const platform = detectPlatform();
    return await this.buildForPlatform(platform, options);
  }
}

export * from "./types.js";
export * from "./platform.js";
export * from "./downloader.js";
export * from "./builders/index.js";
export * from "./logger.js";
export * from "./binary-manager.js";
