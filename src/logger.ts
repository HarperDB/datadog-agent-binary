import chalk from 'chalk';
import { Logger } from './types.js';

export class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix = '[datadog-agent-build]') {
    this.prefix = prefix;
  }

  info(message: string): void {
    console.log(chalk.blue(this.prefix), message);
  }

  warn(message: string): void {
    console.warn(chalk.yellow(this.prefix), chalk.yellow(message));
  }

  error(message: string): void {
    console.error(chalk.red(this.prefix), chalk.red(message));
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(chalk.gray(this.prefix), chalk.gray(message));
    }
  }
}

export const logger = new ConsoleLogger();