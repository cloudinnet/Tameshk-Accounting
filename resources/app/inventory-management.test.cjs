'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

global.document={createElement:()=>({}),head:{appendChild(){}}};
global.state={
  warehouses:[{id:'w1',name:'Main',sectionCount:2,shelvesPerSection:2}],
  products:[
    {id:'editing',warehouseSlots:[{warehouseId:'w1',section:1,shelf:1}]},
    {id:'other',warehouseSlots:[{warehouseId:'w1',section:1,shelf:2}]}
  ]
};
require('./inventory-management.js');
const manager=global.TameshkInventoryManagement;

test('warehouse availability excludes other products but keeps the current product address selectable',()=>{
  const warehouse=global.state.warehouses[0];
  assert.deepEqual(manager.freeSlots(warehouse,'editing'),['1-1','2-1','2-2']);
  assert.deepEqual(manager.freeSlots(warehouse),['2-1','2-2']);
});
