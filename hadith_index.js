const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function main() {
    try {
        const hadithFolder = './hadith';
        
        if (!fs.existsSync(hadithFolder)) {
            fs.mkdirSync(hadithFolder, { recursive: true });
        }

        const db = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database('hadith.db', sqlite3.OPEN_READONLY, (err) => {
                err ? reject(err) : resolve(db);
            });
        });

        // বইগুলির তালিকা লোড করুন
        let books = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM books', [], (err, rows) => {
                err ? reject(err) : resolve(rows);
            });
        });

        // প্রতিটি বই প্রসেস করুন এবং ফাইল সাইজ যোগ করুন
        for (const book of books) {
            console.log(`প্রসেসিং বই ${book.id}: ${book.title}`);
            const fileSize = await processBook(db, book, hadithFolder);
            book.file_size = fileSize; // বই অবজেক্টে ফাইল সাইজ যোগ করুন
        }

        // books.json ফাইল সেভ করুন (সমস্ত বইয়ের তথ্য সহ)
        fs.writeFileSync(
            path.join(hadithFolder, 'books.json'),
            JSON.stringify(books, null, 2)
        );

        db.close();
        console.log('সমস্ত প্রসেসিং সম্পন্ন হয়েছে।');
    } catch (error) {
        console.error('ত্রুটি:', error);
        process.exit(1);
    }
}

async function processBook(db, book, hadithFolder) {
    const zip = new JSZip();

    // চ্যাপ্টার ডেটা
    const chapters = await new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM chapter WHERE book_id = ? ORDER BY number',
            [book.id],
            (err, rows) => err ? reject(err) : resolve(rows)
        );
    });

    // চ্যাপ্টার ফাইল সরাসরি জিপে অ্যাড করুন (ফোল্ডার ছাড়া)
    zip.file(
        `book_${book.id}_chapters.json`,
        JSON.stringify(chapters, null, 2)
    );

    // প্রতিটি চ্যাপ্টারের সেকশন প্রসেস করুন
    for (const chapter of chapters) {
        console.log(`  প্রসেসিং চ্যাপ্টার ${chapter.chapter_id}`);

        const sections = await new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM section WHERE book_id = ? AND chapter_id = ? ORDER BY number',
                [book.id, chapter.chapter_id],
                (err, rows) => err ? reject(err) : resolve(rows)
            );
        });

        const sectionsWithHadiths = [];

        if (sections.length === 0) {
            const hadiths = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? ORDER BY hadith_id',
                    [book.id, chapter.chapter_id],
                    (err, rows) => err ? reject(err) : resolve(rows)
                );
            });

            sectionsWithHadiths.push({
                chapter_id: chapter.chapter_id,
                hadiths: hadiths
            });
        } else {
            for (const section of sections) {
                const hadiths = await new Promise((resolve, reject) => {
                    db.all(
                        'SELECT * FROM hadith WHERE book_id = ? AND chapter_id = ? AND section_id = ? ORDER BY hadith_id',
                        [book.id, chapter.chapter_id, section.section_id],
                        (err, rows) => err ? reject(err) : resolve(rows)
                    );
                });

                sectionsWithHadiths.push({
                    ...section,
                    hadiths: hadiths
                });
            }
        }

        // সেকশন ফাইল সরাসরি জিপে অ্যাড করুন (ফোল্ডার ছাড়া)
        zip.file(
            `book_${book.id}_chapter_${chapter.chapter_id}_sections.json`,
            JSON.stringify(sectionsWithHadiths, null, 2)
        );
    }

    // জিপ ফাইল তৈরি করুন
    const zipContent = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9
        }
    });

    const zipFilePath = path.join(hadithFolder, `book_${book.id}.zip`);
    fs.writeFileSync(zipFilePath, zipContent);
   
    const stats = fs.statSync(zipFilePath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`জিপ ফাইল তৈরি হয়েছে: ${zipFilePath} (সাইজ: ${fileSizeMB} MB)`);
   
    return fileSizeMB;
}

main();