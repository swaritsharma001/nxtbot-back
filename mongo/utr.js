import 'dotenv/config'
import mongo from "mongoose";

const utrSchema = mongo.Schema({
  utr: {
    type: String,
    required: true
  },
 userId: {
   type: String,
   required: true
 },
  status: {
    type: String,
    default: "pending"
  }
})

const Utr = mongo.model("utr", utrSchema)
export default Utr