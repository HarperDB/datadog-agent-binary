import { Platform } from "./platform";

export type Architecture = "x86_64" | "arm64";
export type OS = "linux" | "windows" | "macos";

export interface BuildConfig {
	platform: Platform;
	version?: string;
	outputDir: string;
	sourceDir: string;
	buildArgs?: string[];
}

export interface DownloadConfig {
	version: string;
	platform: Platform;
	extractTo: string;
}

export interface BuildResult {
	success: boolean;
	platform: Platform;
	outputPath?: string;
	error?: string;
	duration: number;
}

export interface Logger {
	info: (message: string) => void;
	warn: (message: string) => void;
	error: (message: string) => void;
	debug: (message: string) => void;
}
