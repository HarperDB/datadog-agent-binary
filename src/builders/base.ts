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
			"dda --no-interactive inv agent.build --build-exclude=systemd"
		);
	}

	protected async executeCommand(
		command: string,
		cwd?: string
	): Promise<string> {
		logger.debug(`Executing: ${command}`);

		try {
			const workingDir = cwd || this.config.sourceDir;

			const result = execSync(command, {
				cwd: workingDir,
				encoding: "utf8",
				stdio: ["inherit", "pipe", "pipe"], // capture both stdout and stderr
				timeout: 1200000, // Default 20 minute timeout
				env: {
					...process.env,
					...this.getEnvironmentVariables(),
				},
			});

			return result.toString();
		} catch (error: any) {
			logger.error(`Command failed: ${command}`);
			logger.error(`Exit code: ${error.status}`);
			logger.error(`Error: ${error.message}`);

			// Show command output if available
			if (error.stdout) {
				logger.error(`Stdout:\n${error.stdout.toString()}`);
			}
			if (error.stderr) {
				logger.error(`Stderr:\n${error.stderr.toString()}`);
			}

			throw error;
		}
	}

	protected getOSEnvironmentVariables(): Record<string, string> {
		return {};
	}

	protected getEnvironmentVariables(): Record<string, string> {
		const { platform } = this.config;
		let env: Record<string, string> = {};

		// Set GOPATH to our project directory to work with mise
		const projectGoPath = path.join(process.cwd(), "go");
		env.GOPATH = projectGoPath;
		env.PATH = `${projectGoPath}/bin${path.delimiter}${process.env.PATH}`;

		switch (platform.arch) {
			case "arm64":
				env.GOARCH = "arm64";
				break;
			case "x64":
				env.GOARCH = "amd64";
				break;
		}

		env.CGO_ENABLED = "1";

		env = {
			...env,
			...this.getOSEnvironmentVariables(),
		};

		return env;
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

	protected getOutputBinaryName(): string {
		return "datadog-agent";
	}

	protected async copyBinariesToOutput(): Promise<void> {
		const { copyFile, mkdir } = await import("fs/promises");

		// Ensure output directory exists
		const absoluteOutputDir = path.isAbsolute(this.config.outputDir)
			? this.config.outputDir
			: path.join(process.cwd(), this.config.outputDir);

		await mkdir(absoluteOutputDir, { recursive: true });

		const sourceFileName = this.getOutputBinaryName();
		const sourcePath = path.join(
			this.config.sourceDir,
			"bin",
			"agent",
			sourceFileName
		);

		const destPath = path.join(absoluteOutputDir, sourceFileName);

		try {
			await copyFile(sourcePath, destPath);
			logger.debug(`Copied ${sourceFileName} to output directory`);
		} catch (error: any) {
			logger.debug(`Failed to copy ${sourceFileName}: ${error.message}`);
			throw error;
		}
	}
}
