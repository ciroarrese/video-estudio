#!/usr/bin/env node
// Launcher: registers tsx so the TypeScript sources run without a build step.
import { register } from 'tsx/esm/api';
register();
process.argv.splice(2, 0, 'qa');
await import('./cli.ts');
