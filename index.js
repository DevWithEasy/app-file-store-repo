const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function main() {
    try {
        // Create the main folders structure
        const hadithFolder = './hadith';
        const chapterFolder = path.join(hadithFolder, 'chapter');
        const sectionFolder = path.join(hadithFolder, 'section');
        const zipsFolder = path.join(hadithFolder, 'zips'); // New folder for zips

        // Ensure directories exist
        if (!fs.existsSync(hadithFolder)) fs.mkdirSync(hadithFolder);
        if (!fs.existsSync(chapterFolder)) fs.mkdirSync(chapterFolder);
        if (!fs.existsSync(sectionFolder)) fs.mkdirSync(sectionFolder);
        if (!fs.existsSync(zipsFolder)) fs.mkdirSync(zipsFolder); // Create zips folder

        // Connect to SQLite database
        const db = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database('hadith.db', sqlite3.OPEN_READONLY, (err) => {
                if (err) reject(err);
                else resolve(db);
            });
        });

        // Process books
        const books = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM books', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Save books.json
        fs.writeFileSync(
            path.join(hadithFolder, 'books.json'),
            JSON.stringify(books, null, 2)
        );

        // Process each book sequentially
        for (const book of books) {
            console.log(`Processing book ${book.id}: ${book.title}`);
            await processBook(db, book, zipsFolder); // Pass zipsFolder to processBook
        }

        db.close();
        console.log('All processing completed successfully.');
    } catch (error) {
        console.error('Fatal error in main process:', error);
        process.exit(1);
    }
}

async function processBook(db, book, zipsFolder) {
    try {
        const zip = new JSZip();
        const bookFolder = zip.folder(`book_${book.id}`);

        // Get all chapters for this book
        const chapters = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM chapter WHERE book_id = ? ORDER BY number',
                [book.id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // Add chapters to zip
        const chapterFileName = `book_${book.id}_chapters.json`;
        bookFolder.file(chapterFileName, JSON.stringify(chapters, null, 2));

        // Process each chapter
        for (const chapter of chapters) {
            await processChapter(db, book, chapter, bookFolder);
        }

        // Generate zip file in zips folder
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(path.join(zipsFolder, `book_${book.id}.zip`), zipContent);
        
        console.log(`Created zip file for book ${book.id} in zips folder`);
    } catch (error) {
        console.error(`Error processing book ${book.id}:`, error);
    }
}

// processChapter function remains the same as before
async function processChapter(db, book, chapter, bookFolder) {
    try {
        console.log(`  Processing chapter ${chapter.chapter_id}: ${chapter.title}`);

        // Get all sections for this chapter
        const sections = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM section WHERE book_id = ? AND chapter_id = ? ORDER BY number',
                [book.id, chapter.chapter_id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // Get hadiths for each section
        const sectionsWithHadiths = [];
       
        if (sections.length === 0) {
            const hadiths = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? ORDER BY hadith_id',
                    [book.id, chapter.chapter_id],
                    (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });

            sectionsWithHadiths.push({
                id: 0,
                book_id: book.id,
                chapter_id: chapter.chapter_id,
                section_id: 0,
                title: 'All Hadiths',
                hadiths: hadiths,
            });
        } else {
            for (const section of sections) {
                const hadiths = await new Promise((resolve, reject) => {
                    db.all(
                        'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? AND section_id = ? ORDER BY hadith_id',
                        [book.id, chapter.chapter_id, section.section_id],
                        (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows);
                        }
                    );
                });

                sectionsWithHadiths.push({
                    ...section,
                    hadiths: hadiths,
                });
            }
        }

        const sectionFileName = `book_${book.id}_chapter_${chapter.chapter_id}_sections.json`;
        bookFolder.file(sectionFileName, JSON.stringify(sectionsWithHadiths, null, 2));
    } catch (error) {
        console.error(`Error processing chapter ${chapter.chapter_id}:`, error);
    }
}

// Start the process
main().catch(err => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
});