import 'dotenv/config'
import jwt from "jsonwebtoken"
import user from "../mongo/user.js"
import mongoose from "mongoose"

const secret= process.env.JWT_SECRET

async function genrateToken(user) {

  try {

    if (!user) {
      return null;
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      },
      secret,
      {
        expiresIn: "30d",
      }
    );

    console.log("Generated Token:", token);

    return token;

  } catch (err) {

    console.log(err);

    return null;

  }
}

async function verifyToken(req, res, next) {

  try {

    const authHeader =
      req.headers.authorization;
    
    

    if (!authHeader) {
      return res.status(401).send({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader

    const decoded = jwt.verify(
      token,
      secret
    );
    
    

    const foundUser =
      await user.findOne({
        Id: decoded.id,
      });
//console.log(foundUser)
    if (!foundUser) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // attach user
    req.user = foundUser;

    next();

  } catch (err) {
console.log(err)
    return res.status(401).send({
      success: false,
      message: err.message,
    });
  }
}

export {verifyToken, genrateToken}