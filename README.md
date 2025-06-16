# Datadog Agent Binary Builder

A TypeScript package that provides pre-built Datadog Agent binaries and tools to build from source for Linux, Windows, and macOS on both arm64 and amd64 architectures.

## Features

- 🚀 **Pre-built binaries**: Automatically installs the appropriate binary for your platform
- 🏗️ **Cross-platform support**: Linux, Windows, macOS (x64, arm64)
- 📦 **Source building**: Build from source when needed
- 🛠️ **Build dependency validation**: Checks for required tools
- 📋 **CLI interface**: Easy-to-use command line tools
- 🎯 **TypeScript**: Full type safety and modern tooling

## Installation

```bash
npm install @harperdb/datadog-agent-binary
```

Or install globally:

```bash
npm install -g @harperdb/datadog-agent-binary
```

When you install this package, it automatically downloads the appropriate pre-built Datadog Agent binary for your platform. If a pre-built binary isn't available, you can build from source.

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

# Build for specific platform
datadog-agent-build build --platform linux-x64
datadog-agent-build build --platform darwin-arm64
datadog-agent-build build --platform windows-x64

# Build for all supported platforms
datadog-agent-build build --all

# Specify version and output directory
datadog-agent-build build --version 7.50.0 --output ./dist
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

// Build for specific platform
const result = await builder.buildForPlatform(
  { os: 'linux', arch: 'x64' },
  {
    version: '7.50.0',
    outputDir: './build/linux-x64'
  }
);

// Build for all platforms
const results = await builder.buildForAllPlatforms({
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
| Windows | arm64 | ✅ |
| macOS | x64 | ✅ |
| macOS | arm64 | ✅ |

## Build Requirements

### Linux
- Go 1.19+
- GCC
- Make
- Git

### macOS
- Go 1.19+
- Xcode Command Line Tools
- Make
- Git

### Windows
- Go 1.19+
- MinGW-w64 GCC
- Make
- Git

## API Reference

### DatadogAgentBuilder

Main class for building Datadog Agent binaries.

#### Methods

- `buildForCurrentPlatform(options?)`: Build for the current platform
- `buildForPlatform(platform, options?)`: Build for a specific platform
- `buildForAllPlatforms(options?)`: Build for all supported platforms

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

2. **Automatic Fallback**: If a pre-built binary isn't available for your platform, the package can build from source.

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
npm run build-platform linux x64
```

## License

MIT
