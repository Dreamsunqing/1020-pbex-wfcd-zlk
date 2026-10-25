import test from 'node:test';import assert from 'node:assert/strict';
import {marketEligibility,marketEligibilityBatch} from '../src/core/wm/eligibility.mjs';
const item=(id,name,tradable)=>({id,name:{en:name},tradable}),catalog=[{id:'bp',gameRef:'/Lotus/Types/Recipes/ExampleBlueprint',english:'Example Prime Blueprint',slug:'example_prime_blueprint'},{id:'barrel',gameRef:'/Lotus/Types/Items/ExampleBarrel',english:'Example Prime Barrel',slug:'example_prime_barrel'},{id:'mod',gameRef:'/Lotus/Upgrades/Mod',english:'Serration',slug:'serration'}];
test('WM gate requires specific entity trade evidence, not a tradable family or component',()=>{
 for(const flag of [false,undefined,null,'true'])assert.equal(marketEligibility(item('/Lotus/Types/Items/ExampleBarrel','Example Prime Barrel',flag),catalog).eligible,false);
 assert.equal(marketEligibility(item('/Lotus/Weapons/Example','Example Prime',false),catalog).eligible,false);
 assert.equal(marketEligibility(item('/Lotus/Weapons/Example','Example Prime',true),catalog).eligible,false);
 assert.equal(marketEligibility(item(catalog[0].gameRef,catalog[0].english,true),catalog).market.slug,'example_prime_blueprint');
 assert.equal(marketEligibility(item(catalog[1].gameRef,catalog[1].english,true),catalog).eligible,true);
 assert.equal(marketEligibility(item('/Lotus/Upgrades/Beginner/Mod','Serration',true),catalog).eligible,false);
 assert.equal(marketEligibility(item('/Lotus/Upgrades/Mod','Serration',true),catalog).eligible,true);
});
test('ambiguous IDs, sets and conflicting explicit identities cannot become a name fallback',()=>{
 const x=item('/Lotus/X','Example',true);assert.equal(marketEligibility(x,[{gameRef:'/Lotus/X',setRoot:true}]).eligible,false);
 assert.equal(marketEligibility(x,[{gameRef:'/Lotus/X'},{gameRef:'/Lotus/X'}]).eligible,false);
 assert.equal(marketEligibility(x,[{gameRef:'/Lotus/Y',english:'Example'}]).eligible,false);
 assert.equal(marketEligibility(x,[{english:'Example',slug:'example'}]).eligible,true);
 assert.equal(marketEligibility(x,[{english:'Example'},{english:'Example'}]).eligible,false);assert.equal(marketEligibility(x,[{english:'Example'},{gameRef:'/Lotus/Y',english:'Example'}]).eligible,false);
});
test('batch uses canonical data rather than renderer-supplied trade claims',()=>{
 const i=item('/Lotus/X','Example',false),data={output:{'items/all.json':[i]}};
 assert.equal(marketEligibilityBatch(data,[{gameRef:i.id}],[i.id])[i.id].eligible,false);
 assert.equal(marketEligibilityBatch(data,catalog,['absent']).absent.reason,'unknown-tradability');
 assert.throws(()=>marketEligibilityBatch(data,catalog,Array(81).fill('x')));
});
