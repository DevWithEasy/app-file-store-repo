const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Promise wrapper for better async handling
function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function main() {
  const dbFile = "./hadith/amalnama.db";
  const booksJsonPath = "./hadith/books.json";

  const db = new sqlite3.Database(dbFile);

  try {
    // Performance optimizations
    await runAsync(db, "PRAGMA journal_mode=OFF");     // Journal বন্ধ - দ্রুত লেখা
    await runAsync(db, "PRAGMA synchronous=OFF");       // Sync বন্ধ - অনেক দ্রুত
    await runAsync(db, "PRAGMA cache_size=100000");     // ক্যাশে সাইজ বড়
    await runAsync(db, "PRAGMA temp_store=MEMORY");     // Temp storage RAM-এ
    await runAsync(db, "PRAGMA locking_mode=EXCLUSIVE"); // Exclusive lock - দ্রুত
    await runAsync(db, "PRAGMA count_changes=OFF");     // Change count বন্ধ

    const booksData = JSON.parse(fs.readFileSync(booksJsonPath, "utf8"));
    const books = booksData;

    console.log(`Total books to process: ${books.length}\n`);

    // পুরো ডাটাবেজের জন্য একটি মাত্র ট্রানজ্যাকশন
    await runAsync(db, "BEGIN TRANSACTION");

    let totalChapters = 0;
    let totalSections = 0;
    let totalHadiths = 0;

    for (const book of books) {
      console.log(`📚 ${book.title} (${book.book_name})`);

      // চ্যাপ্টার ইনসার্ট
      const chaptersPath = path.join("./hadith", book.book_name, "chapters.json");
      if (fs.existsSync(chaptersPath)) {
        const chaptersData = JSON.parse(fs.readFileSync(chaptersPath, "utf8"));
        const chapters = chaptersData;
        
        for (const ch of chapters) {
          await runAsync(db,
            `INSERT OR REPLACE INTO chapter (id, chapter_id, book_id, title, number, hadis_range, book_name) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ch.id, ch.chapter_id, ch.book_id, ch.title, ch.number, ch.hadis_range, ch.book_name]
          );
        }
        totalChapters += chapters.length;
        console.log(`  ✓ Chapters: ${chapters.length}`);
      }

      // সেকশন ইনসার্ট
      const sectionsPath = path.join("./hadith", book.book_name, "sections.json");
      if (fs.existsSync(sectionsPath)) {
        const sectionsData = JSON.parse(fs.readFileSync(sectionsPath, "utf8"));
        const sections = sectionsData;
        
        for (const sec of sections) {
          await runAsync(db,
            `INSERT OR REPLACE INTO section (id, book_id, book_name, chapter_id, section_id, title, preface, number, sort_order) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sec.id, sec.book_id, sec.book_name, sec.chapter_id, sec.section_id, sec.title, sec.preface, sec.number, sec.sort_order]
          );
        }
        totalSections += sections.length;
        console.log(`  ✓ Sections: ${sections.length}`);
      }

      // হাদিস ইনসার্ট (সবচেয়ে বড় ডাটা)
      const hadithsPath = path.join("./hadith", book.book_name, "hadiths.json");
      if (fs.existsSync(hadithsPath)) {
        console.log(`  ⏳ Loading hadiths...`);
        const hadithsData = JSON.parse(fs.readFileSync(hadithsPath, "utf8"));
        const hadiths = hadithsData;
        
        console.log(`  ⏳ Inserting ${hadiths.length} hadiths...`);
        
        let count = 0;
        const startTime = Date.now();
        
        for (const hadith of hadiths) {
          await runAsync(db,
            `INSERT OR REPLACE INTO hadith (id, book_id, book_name, chapter_id, section_id, hadith_key, hadith_id, narrator, bn, note, grade_id, grade, grade_color) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              hadith.id, hadith.book_id, hadith.book_name, hadith.chapter_id,
              hadith.section_id, hadith.hadith_key, hadith.hadith_id, hadith.narrator,
              hadith.bn, hadith.note || "", hadith.grade_id, hadith.grade, hadith.grade_color
            ]
          );
          
          count++;
          // প্রতি 500 টি ইনসার্টে প্রোগ্রেস দেখান
          if (count % 500 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`    ${count}/${hadiths.length} (${elapsed}s)`);
          }
        }
        
        totalHadiths += count;
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ✓ Hadiths: ${count} (${totalTime}s)`);
      }

      console.log(""); // Empty line between books
    }

    // সব শেষে কমিট
    await runAsync(db, "COMMIT");
    
    console.log("═══════════════════════════════");
    console.log("✅ ALL DATA INSERTED SUCCESSFULLY!");
    console.log(`📊 Total Chapters: ${totalChapters}`);
    console.log(`📊 Total Sections: ${totalSections}`);
    console.log(`📊 Total Hadiths: ${totalHadiths}`);
    console.log("═══════════════════════════════");

  } catch (error) {
    await runAsync(db, "ROLLBACK");
    console.error("\n❌ ত্রুটি:", error);
  } finally {
    // Normal settings restore
    await runAsync(db, "PRAGMA journal_mode=DELETE");
    await runAsync(db, "PRAGMA synchronous=NORMAL");
    
    db.close((err) => {
      if (err) console.error("Database close error:", err.message);
      process.exit(0);
    });
  }
}

main();