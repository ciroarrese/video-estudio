#!/usr/bin/env node
// Launcher: registers tsx so the TypeScript sources run without a build step.
import { register } from 'tsx/esm/api';
register();
process.argv.splice(2, 0, 'privacy');
await import('./cli.ts');
