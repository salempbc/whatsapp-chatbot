import fs from 'fs';
import readline from 'readline';

async function inspectXML() {
  const fileStream = fs.createReadStream('public/Tamil Bible.xml', 'utf8');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let bookCount = 0;
  let verseCount = 0;
  let currentBook = '';
  const sampleVerses = {};

  for await (const line of rl) {
    const bookMatch = line.match(/<BIBLEBOOK\s+bnumber="(\d+)"\s+bname="([^"]+)"/);
    if (bookMatch) {
      bookCount++;
      currentBook = bookMatch[2];
    }
    const versMatch = line.match(/<VERS\s+vnumber="(\d+)">([^<]+)<\/VERS>/);
    if (versMatch) {
      verseCount++;
      const text = versMatch[2];
      if (currentBook === 'எண்ணாகமம்' && line.includes('கர்த்தர் உன்னை ஆசீர்வதித்து')) {
        sampleVerses['Num 6:24'] = text;
      }
      if (currentBook === 'சங்கீதம்' && line.includes('கர்த்தர் என் மேய்ப்பராயிருக்கிறார்')) {
        sampleVerses['Ps 23:1'] = text;
      }
      if (currentBook === 'யோவான்' && line.includes('ஒரேபேறான குமாரனை')) {
        sampleVerses['John 3:16'] = text;
      }
      if (currentBook === 'மத்தேயு' && line.includes('இணைத்ததை')) {
        sampleVerses['Matt 19:6'] = text;
      }
    }
  }

  console.log('Total Books:', bookCount);
  console.log('Total Verses:', verseCount);
  console.log('Sample Verses:\n', JSON.stringify(sampleVerses, null, 2));
}

inspectXML().catch(console.error);
