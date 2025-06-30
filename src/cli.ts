#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import { DatadogAgentBuilder, BinaryManager } from "./index.js";
import { logger } from "./logger.js";
import { Platform, getAllSupportedPlatforms } from "./platform.js";

const program = new Command();

program
	.name("datadog-agent-build")
	.description("Build Datadog Agent from source for multiple platforms");

program
	.command("build")
	.description("Build Datadog Agent for current platform")
	.option("--datadog-version <version>", "Datadog Agent version to build")
	.option("-o, --output <dir>", "Output directory", "./build")
	.option("--build-args <args>", "Additional build arguments")
	.option("-d, --debug", "Enable debug logging")
	.action(async (options) => {
		if (options.debug) {
			process.env.DEBUG = "1";
		}

		const builder = new DatadogAgentBuilder();

		try {
			let result;

			logger.info("Building for current platform...");
			const currentPlatform = Platform.current();
			const outputDir = path.join(
				options.output,
				currentPlatform.getName(),
				"bin"
			);
			result = await builder.buildForCurrentPlatform({
				version: options.datadogVersion,
				outputDir,
				buildArgs: options.buildArgs?.split(" "),
			});

			logger.info(`\nBuild Summary:`);
			if (result.success) {
				logger.info(`✅ Successful: ${result.outputPath}`);
				process.exit(0);
			} else {
				logger.error(`❌ Failed: ${result.error}`);
				process.exit(1);
			}
		} catch (error: any) {
			logger.error(`Build failed: ${error.message}`);
			process.exit(1);
		}
	});

program
	.command("platforms")
	.description("List all supported platforms")
	.action(() => {
		const platforms = getAllSupportedPlatforms();

		logger.info("Supported platforms:");
		for (const platform of platforms) {
			logger.info(`  ${platform}`);
		}
	});

program
	.command("version")
	.description("Show latest Datadog Agent version")
	.action(async () => {
		try {
			const builder = new DatadogAgentBuilder();
			const version = await builder["downloader"].getLatestVersion();
			logger.info(`Latest Datadog Agent version: ${version}`);
		} catch (error: any) {
			logger.error(`Failed to fetch version: ${error.message}`);
			process.exit(1);
		}
	});

program
	.command("install")
	.description("Install Datadog Agent binary for current platform")
	.option("-v, --version <version>", "Specific version to install")
	.option("-f, --force", "Force reinstall even if already installed")
	.action(async (options) => {
		try {
			const manager = new BinaryManager();

			if (options.force) {
				logger.info("Force reinstall requested...");
			}

			const binaryPath = await manager.ensureBinary(options.version);
			logger.info(`✅ Datadog Agent installed: ${binaryPath}`);
			logger.info("Run with: datadog-agent <command>");
		} catch (error: any) {
			logger.error(`Installation failed: ${error.message}`);
			logger.info("You can build from source using: datadog-agent-build build");
			process.exit(1);
		}
	});

program.parse();
