// Compatibility entry point; Wiki files now have their own source directory.
if(!process.argv.includes('--enemies-only'))process.argv.push('--enemies-only');
await import('./sync-wiki-images.mjs');
