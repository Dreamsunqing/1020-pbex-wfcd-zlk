#!/usr/bin/env node
import { run } from './资料工具.mjs';
try { await run('启动工作台', process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
