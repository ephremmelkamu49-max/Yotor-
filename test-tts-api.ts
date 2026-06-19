import dotenv from "dotenv";
dotenv.config();

async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/tts?text=hello&lang=am-yotor-epic-male");
    console.log("Status:", res.status);
    console.log("Content-Type:", res.headers.get("content-type"));
    const buffer = await res.arrayBuffer();
    console.log("Size:", buffer.byteLength);
  } catch(e) {
    console.error("error:", e);
  }
}
run();
