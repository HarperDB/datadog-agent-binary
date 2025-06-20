import * as path from "path";
import { BuildResult } from "../types.js";
import { logger } from "../logger.js";
import { BaseBuilder } from "./base.js";

export class WindowsBuilder extends BaseBuilder {
  async build(): Promise<BuildResult> {
    const startTime = Date.now();
    const { platform } = this.config;

    logger.info(`Building Datadog Agent for Windows ${platform.arch}...`);

    try {
      await this.ensureOutputDirectory();


      await this.buildCommon();

      logger.info("Copying binaries to output directory...");
      await this.copyBinariesToOutput();

      const outputPath = this.getAbsoluteOutputPath(this.getOutputBinaryName());
      const duration = Date.now() - startTime;

      logger.info(`Build completed successfully in ${duration}ms`);
      logger.info(`Output: ${outputPath}`);

      return {
        success: true,
        platform,
        outputPath,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`Build failed: ${error.message}`);

      return {
        success: false,
        platform,
        error: error.message,
        duration,
      };
    }
  }


}
