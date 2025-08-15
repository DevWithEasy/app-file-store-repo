const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
const folders = ['surah', 'ayah', 'timing', 'audio'];
folders.forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    console.log(`Created directory: ${dir}`);
  }
});

// Open the database
const db = new sqlite3.Database('./quran.db', sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log('Connected to the Quran database.');
});

// Function to handle database queries with promises
function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Function to write JSON files in specific folders
function writeJsonFile(folder, filename, data) {
  const filePath = path.join(__dirname, folder, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Created file: ${filePath}`);
}

// Main function to process all data
async function processData() {
  try {
    // Create surah.json in surah folder
    const surahs = await dbQuery('SELECT * FROM surah ORDER BY serial');
    writeJsonFile('surah', 'surah.json', surahs);

    // Create reciters.json in audio folder
    const reciters = await dbQuery('SELECT * FROM reciters ORDER BY id');
    writeJsonFile('audio', 'reciters.json', reciters);

    // Process audio data by reciter
    const audioData = await dbQuery('SELECT * FROM audio ORDER BY reciter_id, surah_id');
    const audioByReciter = {};
    
    audioData.forEach(item => {
      if (!audioByReciter[item.reciter_id]) {
        audioByReciter[item.reciter_id] = [];
      }
      audioByReciter[item.reciter_id].push({
        id: item.surah_id,
        link: item.audio_link
      });
    });

    for (const reciterId in audioByReciter) {
      writeJsonFile('audio', `reciter_${reciterId}.json`, audioByReciter[reciterId]);
    }

    // Process ayah data by surah
    const ayahs = await dbQuery('SELECT * FROM ayah ORDER BY surah_id, ayah_id');
    const ayahBySurah = {};
    
    ayahs.forEach(ayah => {
      if (!ayahBySurah[ayah.surah_id]) {
        ayahBySurah[ayah.surah_id] = [];
      }
      ayahBySurah[ayah.surah_id].push({
        id: ayah.ayah_id,
        ar: ayah.arabic,
        tr: ayah.tr_ar,
        bn_haque: ayah.tr_bn_haque,
        bn_muhi: ayah.tr_bn_muhi,
        en: ayah.tr_en
      });
    });

    for (const surahId in ayahBySurah) {
      writeJsonFile('ayah', `surah_${surahId}.json`, ayahBySurah[surahId]);
    }

    // Process verse timings by reciter and surah
    const timings = await dbQuery('SELECT * FROM verse_timings ORDER BY reciter_id, surah_id, ayah');
    const timingsByReciterSurah = {};
    
    timings.forEach(timing => {
      const key = `${timing.reciter_id}_${timing.surah_id}`;
      if (!timingsByReciterSurah[key]) {
        timingsByReciterSurah[key] = [];
      }
      timingsByReciterSurah[key].push({
        ayah: timing.ayah,
        time: timing.time
      });
    });

    for (const key in timingsByReciterSurah) {
      const [reciterId, surahId] = key.split('_');
      writeJsonFile('timing', `reciter_${reciterId}_surah_${surahId}.json`, timingsByReciterSurah[key]);
    }

    console.log('All JSON files created successfully in their respective folders!');
  } catch (err) {
    console.error('Error processing data:', err);
  } finally {
    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log('Closed the database connection.');
    });
  }
}

// Run the main function
processData();