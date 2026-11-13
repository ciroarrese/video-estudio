#!/usr/bin/env node
// Launcher: registers tsx so the TypeScript sources run without a build step.
import { register } from 'tsx/esm/api';
register();
await import('./cli.ts');
