import 'dotenv/config'
import mongoose from "mongoose"

async function connect(){
  await mongoose.connect(process.env.MONGO_URI)
  
}

export {connect}