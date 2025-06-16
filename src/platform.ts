import { Platform } from './types.js';
import * as os from 'os';

export function detectPlatform(): Platform {
  const platform = os.platform();
  const arch = os.arch();

  let osType: Platform['os'];
  switch (platform) {
    case 'linux':
      osType = 'linux';
      break;
    case 'win32':
      osType = 'windows';
      break;
    case 'darwin':
      osType = 'darwin';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  let archType: Platform['arch'];
  switch (arch) {
    case 'x64':
      archType = 'x64';
      break;
    case 'arm64':
      archType = 'arm64';
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
  return [
    { os: 'linux', arch: 'x64' },
    { os: 'linux', arch: 'arm64' },
    { os: 'windows', arch: 'x64' },
    { os: 'windows', arch: 'arm64' },
    { os: 'darwin', arch: 'x64' },
    { os: 'darwin', arch: 'arm64' },
  ];
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