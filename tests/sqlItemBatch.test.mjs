import test from 'node:test';
import assert from 'node:assert/strict';
import { applySqlItemBatches, selectUnresolvedForCreation } from '../utils/sqlItemBatch.ts';

test('275 selected lines execute 11 sequential versioned batches', async () => {
  const items = Array.from({length:275},(_,i)=>i); const seen=[];let active=0;
  const result=await applySqlItemBatches(items,{updated_at:'0'},async (batch, version)=>{
    assert.equal(active++,0);assert.equal(version,String(seen.length));
    await Promise.resolve();seen.push(batch);active--;return {updated_at:String(seen.length)};
  },()=>{});
  assert.equal(result.updated_at,'11');assert.deepEqual(seen.flat(),items);assert.ok(seen.every(x=>x.length===25));
});
test('partial result and uncertain transport stop without replay', async()=>{
  for(const transport of [false,true]){
    let calls=0;
    const run=()=>applySqlItemBatches(Array(75).fill(1),{updated_at:'0'},async()=>{
      calls++;if(calls===2){if(transport)throw Error('timeout');return {updated_at:'2',error_message:'Partial'};}
      return {updated_at:'1'};
    },()=>{});
    if(transport)await assert.rejects(run,/timeout/);else assert.equal((await run()).error_message,'Partial');
    assert.equal(calls,2);
  }
});
test('bulk selection spans pages, preserves manual choices and shares duplicate master description',()=>{
  const rows=Array.from({length:275},(_,i)=>({source_index:i,code:`P${i}`,description:`Part ${i}`,action:'',uom:''}));
  rows[1]={...rows[1],action:'match_existing'};rows[274]={...rows[274],code:'P0',description:'Different source spelling'};
  const selected=selectUnresolvedForCreation(rows);
  assert.equal(selected.filter(x=>x.action==='create_new').length,274);
  assert.equal(selected[1].action,'match_existing');assert.equal(selected[274].description,'Part 0');
  assert.equal(rows[274].description,'Different source spelling');assert.equal(rows[0].action,'');
});
