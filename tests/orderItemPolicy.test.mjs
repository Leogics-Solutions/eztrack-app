import test from 'node:test';
import assert from 'node:assert/strict';
import { orderItemPolicyMode, canChangeOrderItemPolicy } from '../utils/orderItemPolicy.ts';

const data={issuing_entity:{sql_connection_id:14},sql_order_item_policy:{
  mode:'FOLLOW_PO_FREE_TEXT',confirmed:true,approval_source:'human_review_instruction',connection_id:14,review_id:2099}};
test('a saved selection is restricted to one Review and issuer',()=>{
  assert.equal(orderItemPolicyMode(data,2099),'FOLLOW_PO_FREE_TEXT');
  assert.equal(orderItemPolicyMode(data,2103),'COMPANY_DEFAULT');
  assert.equal(orderItemPolicyMode({...data,issuing_entity:{sql_connection_id:2}},2099),'COMPANY_DEFAULT');
  assert.equal(orderItemPolicyMode({},2099),'COMPANY_DEFAULT');
});
test('unconfirmed suggestions never select the nonstock option',()=>{
  for(const patch of [{confirmed:false},{approval_source:'ai_business_decision'},{connection_id:undefined}]){
    assert.equal(orderItemPolicyMode({...data,sql_order_item_policy:{...data.sql_order_item_policy,...patch}},2099),'COMPANY_DEFAULT');
  }
});
test('a confirmed item-only preflight block is editable; submitted or uncertain writes are not',()=>{
  assert.equal(canChangeOrderItemPolicy(true,'needs_item_approval',false),true);
  assert.equal(canChangeOrderItemPolicy(true,'failed',false),false);
  assert.equal(canChangeOrderItemPolicy(false,'created',false),false);
  assert.equal(canChangeOrderItemPolicy(false,'needs_item_approval',true),false);
});
