import mongoose from 'mongoose';
const schema=new mongoose.Schema({fullName:{type:String,required:true,trim:true,maxlength:80},email:{type:String,required:true,lowercase:true,trim:true,unique:true,index:true},passwordHash:{type:String,required:true,select:false}},{timestamps:true});
export const User=mongoose.model('User',schema);