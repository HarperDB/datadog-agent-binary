# Datadog Agent Binary Builder

[![Datadog Agent Binaries](https://github.com/HarperDB/datadog-agent-binary/actions/workflows/build-release.yml/badge.svg)](https://github.com/HarperDB/datadog-agent-binary/actions/workflows/build-release.yml)

An NPM package that provides pre-built Datadog Agent binaries.

Additionally this repo provides tools to build from source for Linux, Windows, and macOS on both arm64 and amd64 architectures (or at least the working subset of those).

## Installation

```bash
npm install @harperdb/datadog-agent-binary
```

Or install globally:

```bash
npm install -g @harperdb/datadog-agent-binary
```

When you install this package, it automatically downloads the appropriate pre-built Datadog Agent binary for your platform.

## Usage

### Using the Datadog Agent

Once installed, you can run the Datadog Agent directly:

```bash
# Run the agent
datadog-agent run

# Check agent status
datadog-agent status

# Show agent version
datadog-agent version
```

### Building from Source

If you need to build from source or want to build for multiple platforms:

```bash
# Build for current platform
datadog-agent-build build

# Specify version and output directory
datadog-agent-build build --version 7.50.0 --output ~/my-datadog-agent-build
```

### Management Commands

```bash
# Install or reinstall binary
datadog-agent-build install

# List supported platforms
datadog-agent-build platforms

# Get latest version
datadog-agent-build version
```

### Programmatic Usage

```typescript
import { DatadogAgentBuilder, BinaryManager } from '@harperdb/datadog-agent-binary';

// Use pre-built binaries
const manager = new BinaryManager();
const binaryPath = await manager.ensureBinary(); // Downloads if needed
console.log(`Datadog Agent at: ${binaryPath}`);

// Build from source
const builder = new DatadogAgentBuilder();

// Build for current platform
const result = await builder.buildForCurrentPlatform({
  version: '7.50.0',
  outputDir: './build'
});
```

## Supported Platforms

| OS | Architecture | Status |
|----|-------------|--------|
| Linux | x64 | ✅ |
| Linux | arm64 | ✅ |
| Windows | x64 | ✅ |
| Windows | arm64 | 🚫 |
| macOS | x64 | ✅ |
| macOS | arm64 | ✅ |

Windows arm64 support is blocked by [Chocolatey](https://chocolatey.org) not supporting arm64 natively.

## Build Requirements

### Linux
- Go 1.23
- Node 18+
- Python 3.12
- GCC
- CMake
- Git

### macOS
- Go 1.23
- Node 18+
- Python 3.12
- Xcode Command Line Tools
- CMake
- Git

### Windows
- Go 1.23
- Node 18+
- Python 3.12
- MinGW-w64 GCC
- CMake
- Git

## API Reference

### DatadogAgentBuilder

Main class for building Datadog Agent binaries.

#### Methods

- `buildForCurrentPlatform(options?)`: Build for the current platform

#### Options

```typescript
interface BuildOptions {
  version?: string;      // Datadog Agent version (default: latest)
  outputDir?: string;    // Output directory (default: ./build)
  sourceDir?: string;    // Source directory (default: downloads source)
  buildArgs?: string[];  // Additional build arguments
}
```

### Platform Detection

```typescript
import { detectPlatform, getAllSupportedPlatforms } from '@harperdb/datadog-agent-binary';

const currentPlatform = detectPlatform();
const allPlatforms = getAllSupportedPlatforms();
```

## How It Works

1. **Pre-built Binaries**: When you install this package, it automatically downloads the appropriate Datadog Agent binary for your platform from GitHub releases.

3. **Release Process**:
   - GitHub Actions builds binaries for all platforms from Datadog Agent source
   - Binaries are packaged and uploaded to GitHub releases
   - npm install downloads the right binary for your platform

## Development

```bash
# Install dependencies
npm install

# Build the TypeScript package
npm run build

# Run type checking
npm run typecheck

# Build a single platform for testing
npm run build-platform
```

## License

Apache License 2.0

The binaries this package downloads, builds, and distributes are licensed and distributed under the Apache License 2.0 as specified in the [Datadog Agent repository](https://github.com/DataDog/datadog-agent). The datadog-agent source code is copyrighted by Datadog, Inc.
