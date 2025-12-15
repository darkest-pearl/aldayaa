import pkg from "pg";

const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    await client.connect();
    console.log("✅ Node connected to Neon successfully");
    const res = await client.query("SELECT 1");
    console.log(res.rows);
    await client.end();
  } catch (err) {
    console.error("❌ Node connection failed");
    console.error(err);
  }
})();
