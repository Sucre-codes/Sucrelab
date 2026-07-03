import mongoose from "mongoose";

let connected = false;

export async function connectDB() {
  if (connected) return mongoose.connection;
  const uri = process.env.MONGO_URI 
  await mongoose.connect(uri);
  connected = true;
  console.log(`[db] connected -> ${uri}`);
  return mongoose.connection;
}
