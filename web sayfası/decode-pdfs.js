const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'flipbook/data');
const pdfDir = path.join(__dirname, 'pdfs');

// pdfs/ klasörü yoksa oluştur
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
  console.log('✅ pdfs/ klasörü oluşturuldu');
}

// data/ klasörü yoksa çık (ilk deployment'ta veri henüz yok)
if (!fs.existsSync(dataDir)) {
  console.log('⚠️  flipbook/data/ klasörü bulunamadı, PDF oluşturma atlanıyor');
  process.exit(0);
}

// data/ klasöründeki tüm .js dosyalarını oku
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.js'));
console.log(`📖 ${files.length} yazar dosyası bulundu`);

let successCount = 0;
let errorCount = 0;

files.forEach(file => {
  try {
    const jsPath = path.join(dataDir, file);
    let jsContent = fs.readFileSync(jsPath, 'utf8');

    // Base64 string'i extract et: window.AUTHOR_PDFS["YAZARADI"] = "BASE64..."
    const match = jsContent.match(/window\.AUTHOR_PDFS\["(.+?)"\]\s*=\s*"(.+)"/);
    if (!match) {
      console.log(`⚠️  ${file}: Base64 bulunamadı`);
      errorCount++;
      return;
    }

    const authorName = match[1];
    const base64Data = match[2];

    // Base64'ü decode et
    const pdfBuffer = Buffer.from(base64Data, 'base64');

    // PDF dosyasını kaydet
    const pdfFileName = `${authorName}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFileName);
    fs.writeFileSync(pdfPath, pdfBuffer);

    successCount++;
    console.log(`✅ ${authorName}.pdf (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    errorCount++;
    console.log(`❌ ${file}: ${e.message}`);
  }
});

console.log(`\n📊 Sonuç: ${successCount} başarılı, ${errorCount} hata`);
