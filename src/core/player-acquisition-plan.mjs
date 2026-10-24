import { allItems } from './merge/repository.mjs';
import { playerAcquisition } from './player-acquisition.mjs';

const cache = new WeakMap();
const prime = item => item?.attributes?.isPrime === true || item?.attributes?.variantType === 'VT_PRIME' || /\bPrime\b/i.test(item?.name?.en ?? '');
function index(data) {
  if (cache.has(data.output)) return cache.get(data.output);
  const byId = new Map(allItems(data).map(item => [item.id, item])), products = new Map(), components = new Map();
  for (const recipe of data.output['recipes.json'] ?? []) {
    if (!products.has(recipe.resultId)) products.set(recipe.resultId, []);
    products.get(recipe.resultId).push(recipe);
  }
  for (const relation of data.output['relations.json'] ?? []) if (relation.kind === 'has-component') {
    if (!components.has(relation.from)) components.set(relation.from, []);
    components.get(relation.from).push({ itemId: relation.to, count: relation.quantity });
  }
  const result = { byId, products, components }; cache.set(data.output, result); return result;
}

// Read-only acquisition routes. A blueprint reward always stays attached to the
// blueprint ID, even when it is needed to manufacture a component of a Prime set.
export function playerAcquisitionPlan(data, item, locale = 'zh-CN') {
  const idx = index(data), groups = new Map(), visited = new Set();
  const componentMode = ['weapon', 'warframe'].includes(item.kind) && prime(item);
  function add(target, role, quantity, forItem = null, required = false) {
    if (!target) return;
    let group = groups.get(target.id);
    if (!group) {
      const sources = playerAcquisition(data, target, locale);
      if (!sources.length && !required) return;
      group = { id: target.id, role, quantity, forIds: [], sources };
      groups.set(target.id, group);
    }
    // Mirror relations and recipes are two descriptions of the same requirement.
    // Conflicting alternative recipes must not turn into a summed or guessed count.
    if (group.quantity !== quantity) group.quantity = null;
    if (forItem && !group.forIds.includes(forItem.id)) group.forIds.push(forItem.id);
  }
  function visit(target, quantity, root = false) {
    if (visited.has(target.id)) return; visited.add(target.id);
    const recipes = target.kind === 'blueprint' ? [] : idx.products.get(target.id) ?? [];
    add(target, root ? 'item' : 'component', quantity, null, componentMode && !root && !recipes.length);
    for (const recipe of recipes) add(idx.byId.get(recipe.id), root ? 'blueprint' : 'component-blueprint', Number.isFinite(quantity) && recipe.quantity > 0 ? Math.ceil(quantity / recipe.quantity) : null, target, componentMode);
    // Component blueprints are acquisition targets; their common crafting
    // ingredients belong to that component's own detail, not the entire set.
    if (!componentMode || !root && !['weapon', 'warframe'].includes(target.kind)) return;
    const materials = new Map();
    for (const recipe of recipes) {
      const perRecipe = new Map(), batches = Number.isFinite(quantity) && recipe.quantity > 0 ? Math.ceil(quantity / recipe.quantity) : null;
      for (const row of recipe.materials ?? []) {
        if (row.itemId === target.id) continue;
        const count = Number.isFinite(row.count) && row.count > 0 && batches ? row.count * batches : null;
        // Some dual weapons list the same weapon twice within ONE recipe.
        perRecipe.set(row.itemId, count === null || perRecipe.get(row.itemId) === null ? null : (perRecipe.get(row.itemId) ?? 0) + count);
      }
      for (const [id, count] of perRecipe) {
        if (!materials.has(id)) materials.set(id, count);
        else if (materials.get(id) !== count) materials.set(id, null);
      }
    }
    // WFCD component relations supplement recipes; they never double-count them.
    const batches = new Set(recipes.map(recipe => Number.isFinite(quantity) && recipe.quantity > 0 ? Math.ceil(quantity / recipe.quantity) : null));
    const multiplier = batches.size === 1 ? [...batches][0] : recipes.length ? null : quantity;
    for (const row of idx.components.get(target.id) ?? []) if (row.itemId !== target.id && !materials.has(row.itemId)) materials.set(row.itemId, Number.isFinite(row.count) && row.count > 0 && multiplier > 0 ? row.count * multiplier : null);
    for (const [id, count] of materials) {
      const part = idx.byId.get(id); if (!part) continue;
      if (part.kind === 'blueprint') add(part, root ? 'blueprint' : 'component-blueprint', count, target, true);
      else if (prime(part)) visit(part, count);
      else add(part, 'material', count, null, true);
    }
  }
  visit(item, 1, true);
  const order = { item: 0, blueprint: 1, component: 2, 'component-blueprint': 2, material: 3 };
  return { componentMode, groups: [...groups.values()].sort((a, b) => order[a.role] - order[b.role]) };
}
