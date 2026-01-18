const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

/* =========================
   LOAD JSON
========================= */
const categoryPath = path.join(__dirname, "dua", "category.json");
const categories = JSON.parse(fs.readFileSync(categoryPath, "utf8"));

/* =========================
   DB INIT
========================= */
const db = new sqlite3.Database("./amar_amol.db");

/* =========================
   MAIN
========================= */
function main() {
  db.serialize(() => {
    // 1️⃣ Create table
    db.run(`
      CREATE TABLE IF NOT EXISTS dua_categories (
        id INTEGER PRIMARY KEY,
        cat_id INTEGER NOT NULL,
        cat_name_bn TEXT NOT NULL,
        cat_icon TEXT,
        no_of_dua INTEGER DEFAULT 0,
        no_of_subcat INTEGER DEFAULT 0
      )
    `);

    // 2️⃣ Prepare insert statement
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO dua_categories
      (id, cat_id, cat_name_bn, cat_icon, no_of_dua, no_of_subcat)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // 3️⃣ Insert data
    categories.forEach(cat => {
      stmt.run(
        cat.id,
        cat.cat_id,
        cat.cat_name_bn,
        cat.cat_icon,
        cat.no_of_dua,
        cat.no_of_subcat
      );
    });

    // 4️⃣ Finalize
    stmt.finalize(() => {
      console.log("✅ Dua categories inserted successfully!");
      db.close();
    });
  });
}

main();
