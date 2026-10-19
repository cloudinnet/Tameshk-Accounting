'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const template=fs.readFileSync(__dirname+'/template-manager.js','utf8');
const context={state:{settings:{invoiceNote:'Default invoice note'}}};
vm.runInNewContext(template.match(/function storedNote\(t\)\{[^\n]+\}/)[0]+';this.note=storedNote;',context);
test('invoice notes inherit configured default when absent or historically empty',()=>{
 assert.equal(context.note({}),'Default invoice note');assert.equal(context.note({note:''}),'Default invoice note');
});
test('transaction note and explicit invoice overrides take precedence including intentional blank override',()=>{
 assert.equal(context.note({note:'Transaction'}),'Transaction');
 assert.equal(context.note({note:'Transaction',invoiceNoteOverride:'Override'}),'Override');
 assert.equal(context.note({note:'Transaction',invoiceNoteOverride:''}),'');
});
test('new transaction textarea receives the escaped configured invoice default',()=>{
 const index=fs.readFileSync(__dirname+'/index.html','utf8');
 assert.match(index,/<textarea id="txnote"[^>]*>\$\{esc\(state\.settings\.invoiceNote\|\|''\)\}<\/textarea>/);
});
