import fs from 'fs';
import dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/tts?text=hello&lang=am-yotor-epic-male");
    const buffer = await res.arrayBuffer();
    fs.writeFileSync('test.wav', Buffer.from(buffer));
    console.log("Written test.wav");
  } catch(e) {
    console.error("error:", e);
  }
}
run();
