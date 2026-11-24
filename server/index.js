import mongoose from 'mongoose';
import {app} from './app.js';
import {config,validateConfig} from './config.js';

validateConfig();

const server=app.listen(config.port,()=> {
  console.log('SafarRakshak API listening on port '+config.port);
});

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let shuttingDown=false;
let connecting=true;

async function connectDatabase(){
  while(!shuttingDown){
    try{
      await mongoose.connect(config.mongoUri,{serverSelectionTimeoutMS:10000});
      console.log('MongoDB connection established.');
      return;
    }catch(error){
      console.error('MongoDB connection failed; retrying in 15 seconds. Check Atlas Network Access and the connection string:',error.message);
      await wait(15000);
    }
  }
}

mongoose.connection.on('disconnected',()=>{
  console.warn('MongoDB disconnected.');
  if(!connecting&&!shuttingDown){
    connecting=true;
    connectDatabase().finally(()=>{connecting=false;});
  }
});

connectDatabase().finally(()=>{connecting=false;});

async function shutdown(signal){
  shuttingDown=true;
  console.log(signal+' received; shutting down gracefully.');
  server.close(async()=>{
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(()=>process.exit(1),10000).unref();
}

process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
