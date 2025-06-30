#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Import platform configuration from TypeScript source
const { getAllPlatformNames } = require("../dist/platforms.js");
const platforms = getAllPlatformNames();

// Update optionalDependencies to use the same version as the main package
packageJson.optionalDependencies = {};
platforms.forEach((platform) => {
	packageJson.optionalDependencies[
		`@harperdb/datadog-agent-binary-${platform}`
	] = packageJson.version;
});

fs.writeFileSync(
	packageJsonPath,
	JSON.stringify(packageJson, null, "\t") + "\n"
);

console.log(`Updated optionalDependencies to version ${packageJson.version}`);
