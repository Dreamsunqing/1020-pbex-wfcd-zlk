#!/usr/bin/env node
import { run } from './资料工具.mjs';
try { await run('获取官方图片', process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
