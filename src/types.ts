export interface Platform {
	os: "linux" | "windows" | "darwin";
	arch: "x64" | "arm64";
}

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
