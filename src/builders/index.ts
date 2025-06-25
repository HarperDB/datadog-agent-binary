import { BuildConfig } from "../types.js";
import { BaseBuilder } from "./base.js";
import { LinuxBuilder } from "./linux.js";
import { WindowsBuilder } from "./windows.js";
import { DarwinBuilder } from "./darwin.js";

export function createBuilder(config: BuildConfig): BaseBuilder {
	const { platform } = config;

	switch (platform.os) {
		case "linux":
			return new LinuxBuilder(config);
		case "windows":
			return new WindowsBuilder(config);
		case "darwin":
			return new DarwinBuilder(config);
		default:
			throw new Error(`Unsupported platform: ${platform.os}`);
	}
}

export { BaseBuilder, LinuxBuilder, WindowsBuilder, DarwinBuilder };
