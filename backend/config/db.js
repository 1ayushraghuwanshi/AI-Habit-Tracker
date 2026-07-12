import mongoose from "mongoose";

export const connectDB = async () => {
    try{
        const uri  = process.env.MONGO_URI;
        if(!uri) throw new Error("Mongo_uri is not define");
        const conn = await mongoose.connect(uri);
        console.log("db connected");
    }catch(err){
        console.log("Mongo connection error", err.message);
        process.exit(1);
        
    }
}