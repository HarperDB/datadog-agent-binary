import * as os from "os";
import { Platform } from "./types.js";

export interface PlatformConfig {
	os: string;
	arch: string;
	cpu: string;
	binary: string;
	packageName: string;
}

export const SUPPORTED_PLATFORMS: PlatformConfig[] = [
	{
		os: "linux",
		arch: "x64",
		cpu: "x64",
		binary: "datadog-agent",
		packageName: "linux-x64",
	},
	{
		os: "linux",
		arch: "arm64",
		cpu: "arm64",
		binary: "datadog-agent",
		packageName: "linux-arm64",
	},
	{
		os: "darwin",
		arch: "x64",
		cpu: "x64",
		binary: "datadog-agent",
		packageName: "darwin-x64",
	},
	{
		os: "darwin",
		arch: "arm64",
		cpu: "arm64",
		binary: "datadog-agent",
		packageName: "darwin-arm64",
	},
	{
		os: "windows",
		arch: "x64",
		cpu: "x64",
		binary: "datadog-agent.exe",
		packageName: "windows-x64",
	},
];

// Platform configuration functions
export function getPlatformConfig(
	os: string,
	arch: string
): PlatformConfig | undefined {
	return SUPPORTED_PLATFORMS.find((p) => p.os === os && p.arch === arch);
}

export function getAllPlatformNames(): string[] {
	return SUPPORTED_PLATFORMS.map((p) => p.packageName);
}

export function getPlatformByName(name: string): PlatformConfig | undefined {
	return SUPPORTED_PLATFORMS.find((p) => p.packageName === name);
}

// Legacy platform functions (migrated from platform.ts)
export function detectPlatform(): Platform {
	const platform = os.platform();
	const arch = os.arch();

	let osType: Platform["os"];
	switch (platform) {
		case "linux":
			osType = "linux";
			break;
		case "win32":
			osType = "windows";
			break;
		case "darwin":
			osType = "darwin";
			break;
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}

	let archType: Platform["arch"];
	switch (arch) {
		case "x64":
			archType = "x64";
			break;
		case "arm64":
			archType = "arm64";
			break;
		default:
			throw new Error(`Unsupported architecture: ${arch}`);
	}

	return { os: osType, arch: archType };
}

export function getPlatformString(platform: Platform): string {
	return `${platform.os}-${platform.arch}`;
}

export function getAllSupportedPlatforms(): Platform[] {
	return SUPPORTED_PLATFORMS.map((p) => ({
		os: p.os as Platform["os"],
		arch: p.arch as Platform["arch"],
	}));
}

export function validatePlatform(platform: Platform): void {
	const supported = getAllSupportedPlatforms();
	const isSupported = supported.some(
		(p) => p.os === platform.os && p.arch === platform.arch
	);

	if (!isSupported) {
		throw new Error(`Unsupported platform: ${getPlatformString(platform)}`);
	}
}
