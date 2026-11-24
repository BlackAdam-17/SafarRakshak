import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {app} from '../app.js';

test('health endpoint responds and reports database connection state',async()=>{
 const server=app.listen(0);
 try{
  const {port}=server.address();
  const response=await fetch('http://127.0.0.1:'+port+'/api/health');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{status:'ok',service:'SafarRakshak API',database:'disconnected'});
 }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('readiness endpoint reports unavailable while database is disconnected',async()=>{
 const server=app.listen(0);
 try{
  const {port}=server.address();
  const response=await fetch('http://127.0.0.1:'+port+'/api/health/ready');
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{status:'not_ready',database:'disconnected'});
 }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('unknown API paths return JSON 404',async()=>{
 const server=app.listen(0);
 try{
  const {port}=server.address();
  const response=await fetch('http://127.0.0.1:'+port+'/api/no-such-route');
  assert.equal(response.status,404);
  assert.equal(typeof (await response.json()).error,'string');
 }finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
