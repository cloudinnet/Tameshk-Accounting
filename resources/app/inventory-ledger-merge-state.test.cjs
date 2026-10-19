'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('sale cost and inventory value survive central save replacing the state object', () => {
  const ctx = {
    console, Date, Math, Number, Map, Set, Object, Array, JSON, String, Intl,
    state: { settings:{language:'fa'}, products:[{id:'p1',name:'کالا',unit:'عدد',baseUnit:'عدد',stock:10,cost:2,price:12,history:[]}], transactions:[], expenses:[] },
    localStorage:{setItem(){}}, document:{getElementById(){return null}},
    save(){ this.state = structuredClone(this.state); return true; },
    showToast(){}, openModal(){}, closeModal(){}, render(){}, todayISO(){return '2026-09-28';}, money(v){return String(v)}, esc(v){return String(v)},
    saveTransaction(){ const p=this.state.products[0]; const tx={id:'t1',no:'1',date:'2026-09-28',createdAt:'2026-09-28T10:00:00.000Z',items:[{name:'کالا',productId:'p1',qty:2,baseQty:2,unit:'عدد',baseUnit:'عدد',price:10,priceAtSale:10}]}; p.stock-=2;this.state.transactions.push(tx);this.save();return tx; }
  };
  ctx.window=ctx;ctx.__tameshkGetState=()=>ctx.state;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'inventory-ledger.js'),'utf8'),ctx,{filename:'inventory-ledger.js'});
  ctx.saveTransaction();
  assert.equal(ctx.state.products[0].stock,8);
  assert.equal(ctx.state.products[0].inventoryValue,16);
  assert.equal(ctx.state.transactions[0].items[0].costAtSale,2);
  assert.equal(ctx.state.transactions[0].items[0].cogs,4);
  assert.equal(ctx.state.inventoryLedger.events.filter(e=>e.type==='sale').length,1);
});
