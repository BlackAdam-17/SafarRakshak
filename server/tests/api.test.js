import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../app.js';

test('health endpoint responds without a database connection',async()=>{
 const server=app.listen(0);
 try{const {port}=server.address();const response=await fetch('http://127.0.0.1:'+port+'/api/health');assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ok',service:'SafarRakshak API'});}
 finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
test('unknown API paths return JSON 404',async()=>{
 const server=app.listen(0);
 try{const {port}=server.address();const response=await fetch('http://127.0.0.1:'+port+'/api/no-such-route');assert.equal(response.status,404);assert.equal(typeof (await response.json()).error,'string');}
 finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});