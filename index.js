const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

/* =========================
   LOAD JSON
========================= */

const hadiths = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "hadith_json", "hadiths.json"),
    "utf8"
  )
);


/* =========================
   DB INIT
========================= */
const db = new sqlite3.Database("./hadith.db");

/* =========================
   INSERT HELPERS
========================= */




/* =========================
   MAIN
========================= */
async function main() {
 
}

main();
