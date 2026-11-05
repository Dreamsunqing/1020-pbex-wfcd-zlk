// The App's one rule for the two spellings of an item ID: world state and drop tables write /Lotus/StoreItems/…, the
// library and the exports write /Lotus/…. Only the leading segment is rewritten; a "StoreItems" segment further down the
// path (for example /Lotus/Types/StoreItems/Boosters/…) is part of the ID and stays.
// No imports and no file access, so both the main process (merge/contract.mjs re-exports it) and the renderer can load it.
export const storeItemId = value => typeof value === 'string' ? value.replace(/^\/Lotus\/StoreItems\//, '/Lotus/') : null;
