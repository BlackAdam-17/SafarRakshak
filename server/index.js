import mongoose from 'mongoose';
import {app} from './app.js';
import {config,validateConfig} from './config.js';
try{validateConfig();await mongoose.connect(config.mongoUri,{serverSelectionTimeoutMS:10000});app.listen(config.port,()=>console.log('SafarRakshak API listening on port '+config.port));}catch(error){console.error('Could not start SafarRakshak API:',error.message);process.exit(1);}