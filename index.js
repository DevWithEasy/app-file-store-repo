const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Create the main hadith folder structure
        const hadithFolder = './hadith';
        const chapterFolder = path.join(hadithFolder, 'chapter');
        const sectionFolder = path.join(hadithFolder, 'section');

        // Ensure directories exist
        if (!fs.existsSync(hadithFolder)) fs.mkdirSync(hadithFolder);
        if (!fs.existsSync(chapterFolder)) fs.mkdirSync(chapterFolder);
        if (!fs.existsSync(sectionFolder)) fs.mkdirSync(sectionFolder);

        // Connect to SQLite database with better error handling
        const db = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database('hadith.db', sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('Error opening database', err);
                    reject(err);
                } else {
                    console.log('Connected to the SQLite database.');
                    resolve(db);
                }
            });
        });

        // Process books
        const books = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM books', [], (err, rows) => {
                if (err) {
                    console.error('Error fetching books', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        // Save books.json
        fs.writeFileSync(
            path.join(hadithFolder, 'books.json'),
            JSON.stringify(books, null, 2)
        );

        // Process each book sequentially to avoid memory issues
        for (const book of books) {
            console.log(`Processing book ${book.id}: ${book.title}`);
            await processBook(db, book);
        }

        db.close();
        console.log('All processing completed successfully.');
    } catch (error) {
        console.error('Fatal error in main process:', error);
        process.exit(1);
    }
}

async function processBook(db, book) {
    try {
        // Get all chapters for this book
        const chapters = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM chapter WHERE book_id = ? ORDER BY number',
                [book.id],
                (err, rows) => {
                    if (err) {
                        console.error(`Error fetching chapters for book ${book.id}`, err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        // Save chapters to file
        const chapterFileName = `book_${book.id}_chapters.json`;
        fs.writeFileSync(
            path.join('./hadith/chapter', chapterFileName),
            JSON.stringify(chapters, null, 2)
        );

        // Process each chapter sequentially
        for (const chapter of chapters) {
            await processChapter(db, book, chapter);
        }
    } catch (error) {
        console.error(`Error processing book ${book.id}:`, error);
    }
}

async function processChapter(db, book, chapter) {
    try {
        console.log(`  Processing chapter ${chapter.chapter_id}: ${chapter.title}`);

        // Get all sections for this chapter
        const sections = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM section WHERE book_id = ? AND chapter_id = ? ORDER BY number',
                [book.id, chapter.chapter_id],
                (err, rows) => {
                    if (err) {
                        console.error(
                            `Error fetching sections for book ${book.id} chapter ${chapter.chapter_id}`,
                            err
                        );
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });

        // Get hadiths for each section
        const sectionsWithHadiths = [];
        
        if (sections.length === 0) {
            // If no sections, get all hadiths for the chapter
            const hadiths = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? ORDER BY hadith_id',
                    [book.id, chapter.chapter_id],
                    (err, rows) => {
                        if (err) {
                            console.error(
                                `Error fetching hadiths for book ${book.id} chapter ${chapter.chapter_id}`,
                                err
                            );
                            reject(err);
                        } else {
                            resolve(rows);
                        }
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
            // Process each section
            for (const section of sections) {
                const hadiths = await new Promise((resolve, reject) => {
                    db.all(
                        'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? AND section_id = ? ORDER BY hadith_id',
                        [book.id, chapter.chapter_id, section.section_id],
                        (err, rows) => {
                            if (err) {
                                console.error(
                                    `Error fetching hadiths for book ${book.id} chapter ${chapter.chapter_id} section ${section.section_id}`,
                                    err
                                );
                                reject(err);
                            } else {
                                resolve(rows);
                            }
                        }
                    );
                });

                sectionsWithHadiths.push({
                    ...section,
                    hadiths: hadiths,
                });
            }
        }

        // Save sections to file
        const sectionFileName = `book_${book.id}_chapter_${chapter.chapter_id}_sections.json`;
        fs.writeFileSync(
            path.join('./hadith/section', sectionFileName),
            JSON.stringify(sectionsWithHadiths, null, 2)
        );
    } catch (error) {
        console.error(`Error processing chapter ${chapter.chapter_id}:`, error);
    }
}

// Start the process
main().catch(err => {
    console.error('Unhandled error in main:', err);
    process.exit(1);
});