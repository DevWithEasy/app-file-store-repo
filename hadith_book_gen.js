const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const db = new sqlite3.Database("./hadith.db");
const OUTPUT_DIR = path.join(__dirname, "output");

// helper: query → promise
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// helper: write json
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR);
    }

    // 1️⃣ সব বই বের করি
    const books = await all(`SELECT * FROM books`);

    for (const book of books) {
      const bookId = book.id;
      const bookDir = path.join(OUTPUT_DIR, `book_${bookId}`);

      fs.mkdirSync(bookDir, { recursive: true });

      console.log(`📘 Processing book ${bookId}`);

      // 2️⃣ book.json
      writeJSON(
        path.join(bookDir, "book.json"),
        book
      );

      // 3️⃣ chapters.json
      const chapters = await all(
        `SELECT * FROM chapter WHERE book_id = ? ORDER BY chapter_id`,
        [bookId]
      );
      writeJSON(
        path.join(bookDir, "chapters.json"),
        chapters
      );

      // 4️⃣ sections.json
      const sections = await all(
        `SELECT * FROM section WHERE book_id = ? ORDER BY chapter_id, section_id`,
        [bookId]
      );
      writeJSON(
        path.join(bookDir, "sections.json"),
        sections
      );

      // 5️⃣ hadiths.json
      const hadiths = await all(
        `SELECT * FROM hadith WHERE book_id = ? ORDER BY chapter_id, hadith_id`,
        [bookId]
      );
      writeJSON(
        path.join(bookDir, "hadiths.json"),
        hadiths
      );
    }

    console.log("🎉 All books exported successfully!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    db.close();
  }
}

main();
