#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read the main package.json to get the version
const mainPackageJson = JSON.parse(
	fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);
const version = mainPackageJson.version;

// Import platform configuration from TypeScript source
const { SUPPORTED_PLATFORMS } = require("../dist/platforms.js");
const platforms = SUPPORTED_PLATFORMS;

const packageTemplate = {
	version: version,
	description: "",
	main: "index.js",
	repository: {
		type: "git",
		url: "https://github.com/HarperDB/datadog-agent-binary.git",
	},
	keywords: ["datadog", "agent", "binary"],
	author: "HarperDB",
	license: "Apache-2.0",
	files: ["bin/", "index.js"],
};

const indexTemplate = `const path = require('path');

module.exports = {
  getBinaryPath() {
    return path.join(__dirname, 'bin', 'BINARY_NAME');
  }
};`;

platforms.forEach((platform) => {
	const platformName = platform.packageName;
	const packageDir = path.join(__dirname, "..", "npm", platformName);

	// Create directory
	fs.mkdirSync(packageDir, { recursive: true });
	fs.mkdirSync(path.join(packageDir, "bin"), { recursive: true });

	// Create package.json
	const packageJson = {
		...packageTemplate,
		name: `@harperdb/datadog-agent-binary-${platformName}`,
		description: `Datadog Agent binary for ${platform.os} ${platform.arch}`,
		os: [platform.os],
		cpu: [platform.cpu],
		keywords: [...packageTemplate.keywords, platform.os, platform.arch],
	};

	fs.writeFileSync(
		path.join(packageDir, "package.json"),
		JSON.stringify(packageJson, null, 2)
	);

	// Create index.js
	const indexContent = indexTemplate.replace("BINARY_NAME", platform.binary);
	fs.writeFileSync(path.join(packageDir, "index.js"), indexContent);

	console.log(`Created package: ${packageJson.name}`);
});

console.log("Platform packages created successfully!");
