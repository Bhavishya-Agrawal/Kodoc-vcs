import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "kodoc_super_secret_key";
const MONGO_URI = "mongodb://127.0.0.1:27017/kodoc";

async function testApi() {
  try {
    // Generate a valid token
    await mongoose.connect(MONGO_URI);
    const User = (await import("./models/User.js")).default;
    let user = await User.findOne();
    if (!user) {
      user = await User.create({ username: "testapi", email: "api@test.com", password: "pwd" });
    }
    const token = jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: "1h" });
    await mongoose.disconnect();

    // Hit the API
    console.log("Sending POST to http://localhost:5000/api/documents...");
    const res = await fetch("http://localhost:5000/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ title: "API Test" })
    });
    
    if (!res.ok) {
        console.error("API ERROR:", res.status, await res.text());
    } else {
        console.log("Success:", await res.json());
    }
  } catch (error) {
    console.error("NETWORK ERROR:", error.message);
  }
}

testApi();
