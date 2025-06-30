import { Architecture, OS } from "./types";

export abstract class Platform {
	protected readonly arch: Architecture;

	constructor(arch: Architecture) {
		this.arch = arch;
	}

	private static processArchToArchitecture(): Architecture {
		switch (process.arch) {
			case "x64":
				return "x86_64";
			case "arm64":
				return "arm64";
			default:
				throw new Error(`Unsupported architecture: ${process.arch}`);
		}
	}

	static current(): Platform {
		const arch = this.processArchToArchitecture();
		switch (process.platform) {
			case "linux":
				return new Linux(arch);
			case "darwin":
				return new MacOS(arch);
			case "win32":
				return new Windows(arch);
			default:
				return new Unknown(arch);
		}
	}

	getArch(): Architecture {
		return this.arch;
	}

	getGoArch(): string {
		switch (this.arch) {
			case "x86_64":
				return "amd64";
			default:
				return this.arch;
		}
	}

	getName(): string {
		return `${this.getOS()}-${this.getArch()}`;
	}

	abstract getOS(): OS;
	abstract getBinaryName(): string;
}

abstract class Unix extends Platform {
	abstract getOS(): OS;

	getBinaryName(): string {
		return "datadog-agent";
	}
}

class Linux extends Unix {
	getOS(): OS {
		return "linux";
	}
}

class MacOS extends Unix {
	getOS(): OS {
		return "macos";
	}
}

class Windows extends Platform {
	getOS(): OS {
		return "windows";
	}

	getBinaryName(): string {
		return "datadog-agent.exe";
	}
}

class Unknown extends Platform {
	getOS(): OS {
		throw new Error("Unknown OS");
	}

	getBinaryName(): string {
		throw new Error("Unknown binary name");
	}
}

export const SUPPORTED_PLATFORMS: Platform[] = [
	new Linux("x86_64"),
	new Linux("arm64"),
	new MacOS("x86_64"),
	new MacOS("arm64"),
	new Windows("x86_64"),
];

export function getAllSupportedPlatforms(): string[] {
	return SUPPORTED_PLATFORMS.map((p) => p.getName());
}
