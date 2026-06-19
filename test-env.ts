import dotenv from "dotenv";
dotenv.config();
console.log("Key exists?", !!process.env.GEMINI_API_KEY);
