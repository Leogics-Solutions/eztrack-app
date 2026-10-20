import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSqlStock, sqlStockChoices, validNewStockCode } from '../utils/sqlStockChoice.ts';

test('Review 2309 free-text products can return to SQL matching without losing source money or descriptions', () => {
  const line = { name:'Radiator assy', model:'TLX-12139-PA26.', qty:160, unit:'PCS', amount_myr:17374.4,
    sql_item_mode:'free_text', match:{matched:true,sku_code:null,en_description:'Radiator assy'} };
  assert.deepEqual(sqlStockChoices([line], [], false), []);
  const stock = selectSqlStock(line);
  assert.equal(stock.sql_stock_required,true);
  assert.equal(stock.sql_allow_free_text_fallback,false);
  assert.equal(stock.match.matched,false);
  assert.equal(stock.match.sku_code,null);
  assert.equal(stock.source_part_no,'TLX-12139-PA26.');
  for(const key of ['name','model','qty','unit','amount_myr']) assert.equal(stock[key],line[key]);
  assert.deepEqual(sqlStockChoices([stock], [], false), [{source_index:0,code:'TLX-12139-PA26.',description:'Radiator assy',uom:'PCS'}]);
  assert.equal(line.sql_item_mode,'free_text');
});

test('stock selection never includes headers, deductions, matched lines or an order-wide free-text choice', () => {
  const ordinary=selectSqlStock({name:'Part',model:'P-1',match:{}});
  const rows=[ordinary,...['header','deduction','included_component'].map(category=>selectSqlStock({name:'Context',category,model:'TEXT'})),
    {...ordinary,match:{sku_code:'P-1',matched:true}}];
  assert.equal(sqlStockChoices(rows,[],false).length,1);
  assert.deepEqual(sqlStockChoices(rows,[],true),[]);
  assert.equal(selectSqlStock(rows[1]),rows[1]);
});

test('SQL product without a source code still offers manual resolution after explicit stock choice', () => {
  const stock=selectSqlStock({name:'New part',match:{}});
  assert.equal(sqlStockChoices([stock],[],false)[0].code,'');
});

test('new code validation matches backend 30-character SQL format including spaces and dots', () => {
  for(const code of ['TLX-12139-PA26.','A-AC HOSE-BH10.2-22.5MM','A'.repeat(30)]) assert.equal(validNewStockCode(code),true,code);
  for(const code of ['A'.repeat(31),'A','CODE**','CODE\nX']) assert.equal(validNewStockCode(code),false,code);
});
