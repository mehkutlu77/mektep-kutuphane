const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execFile } = require('child_process');

/* Sunucu portu. Render/Heroku gibi platformlar portu PORT ortam değişkeniyle
   dayatır; sabit 3000 bırakılırsa platform "yanlış portu dinliyor" deyip
   dağıtımı yeniden başlatmak zorunda kalır (Render ilk dağıtımda tam bunu
   yaptı: "New primary port detected: 3000. Restarting deploy..."). Ortam
   değişkeni yoksa yerelde eskisi gibi 3000 kullanılır — Mac_Baslat.command ve
   Windows_Baslat.bat localhost:3000 açtığı için bu şart. */
const PORT = process.env.PORT || 3000;

// Statik dosyaların kökü. server.js zaten web sayfası/ içinde, __dirname doğrudan burada.
const WEB_KOK = __dirname;

// MIME types lookup
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon'
};

/* KULLANICI ADI ÜRETİMİ — 2026-08-06'da düzeltildi.
   ESKİ HATA: önce `name.toLowerCase()` çağrılıyor, SONRA Türkçe harf haritası
   uygulanıyordu. JavaScript'in yerel-duyarsız toLowerCase'i 'İ' harfini
   "i + U+0307 (birleşen nokta)" olarak çeviriyor; birleşen nokta haritada
   olmadığı için hayatta kalıyor ve son satırdaki `[^a-z0-9] → '.'` onu NOKTAYA
   çeviriyordu. Sonuç: "EMİN KEVEN" → **emi.n.keven**, "BİLGİN PELİSTER" →
   **bi.lgi.n.peli.ster**. 62 yazarın 16'sında kullanıcı adı bu şekilde
   bozulmuştu; yazarlar kendi kullanıcı adlarını tahmin edemiyordu.
   ÇÖZÜM: harita ÖNCE (özgün harfler üzerinde) uygulanıyor, sonra küçültme
   yapılıyor; artakalan birleşen işaretler de NFD ile ayıklanıyor. */
function nameToUsername(name) {
    const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u', 'Â': 'a', 'Î': 'i', 'Û': 'u' };
    let clean = (name || '').split('').map(char => map[char] || char).join('').toLowerCase();
    clean = clean.normalize('NFD').replace(/[̀-ͯ]/g, '');
    clean = clean.replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
    return clean;
}

// Bozuk (eski üreteçten kalma) kullanıcı adını tanır: tek harflik parça,
// hiçbir insanın seçmeyeceği bir imzadır ("emi.n.keven" → "n" parçası).
// Yöneticinin elle verdiği özel kullanıcı adları bu testten geçmez, yani
// onarım onlara dokunmaz.
function kullaniciAdiBozukMu(username) {
    if (!username) return false;
    return username.split('.').some(parca => parca.length === 1);
}

function dbKullaniciGuncelle() {
    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
    if (!fs.existsSync(dbPath)) return;
    try {
        let raw = fs.readFileSync(dbPath, 'utf8');
        let authors = JSON.parse(raw);
        let degisti = false;
        
        const kullanilan = new Set(authors.map(a => a.username).filter(Boolean));

        authors.forEach(author => {
            if (!author.username) {
                author.username = nameToUsername(author.name);
                kullanilan.add(author.username);
                degisti = true;
            } else if (kullaniciAdiBozukMu(author.username)) {
                // Eski hatalı üreteçten kalma bozuk kullanıcı adını onar.
                const yeni = nameToUsername(author.name);
                if (yeni && yeni !== author.username && !kullanilan.has(yeni)) {
                    console.log(`  ↻ Bozuk kullanıcı adı onarıldı: ${author.name} — "${author.username}" → "${yeni}"`);
                    kullanilan.delete(author.username);
                    kullanilan.add(yeni);
                    author.username = yeni;
                    degisti = true;
                }
            }
            if (!author.password) {
                author.password = 'mektep123';
                degisti = true;
            }
        });
        
        if (degisti) {
            fs.writeFileSync(dbPath, JSON.stringify(authors, null, 2), 'utf8');
            console.log("✓ Veritabanı kullanıcı adları ve şifreleri güncellendi (Varsayılan şifre: mektep123).");
            // cwd: __dirname ŞART — sunucu başka bir klasörden başlatılırsa
            // (örn. havuz kökünden `node "30. PROGRAM .../server.js"`) script
            // adı bulunamaz ve sessizce başarısız olur. /api/sync'te zaten
            // vardı, bu üç çağrıda eksikti.
            exec('node build_library.js', { cwd: __dirname, maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
                if (!err) console.log("✓ Kütüphane yeni kimlik bilgileriyle yeniden oluşturuldu.");
                else console.error("Kütüphane yeniden oluşturulamadı:", err.message);
            });
        }
    } catch(e) {
        console.error("Kullanıcı güncellerken hata oluştu:", e);
    }
}

/* KİTAPÇIK + KÜTÜPHANE YENİDEN ÜRETİMİ
   Bir yazı eklendiğinde/onaylandığında iki şeyin yenilenmesi gerekir:
     1) generate_pdf_kit.js → yazarın kitapçık PDF'i (flipbook/data/*.js) ve
        veritabanına sayfa/İçindekiler bilgisi
     2) build_library.js    → kütüphane + yönetim sayfaları (istatistikler)
   SIRA ÖNEMLİ: (1) veritabanını zenginleştirir, (2) o veriden sayfa üretir.

   `yazarAdi` verilirse yalnızca o yazarın kitapçığı üretilir (~1 sn);
   verilmezse tüm yazarlar (~41 sn bu makinede, ücretsiz sunucuda dakikalarca).
   execFile kullanılıyor: yazar adları boşluk ve Türkçe karakter içerdiği için
   kabuk üzerinden geçirmek riskli. */
function yenidenUret(yazarAdi, callback) {
    const opts = { cwd: __dirname, maxBuffer: 50 * 1024 * 1024 };
    const args = yazarAdi ? ['generate_pdf_kit.js', yazarAdi] : ['generate_pdf_kit.js'];

    execFile('node', args, opts, (err, stdout, stderr) => {
        if (err) return callback(err, stderr);
        execFile('node', ['build_library.js'], opts, (err2, stdout2, stderr2) => {
            if (err2) return callback(err2, stderr2);
            callback(null, null);
        });
    });
}

// Yönetici kimlik bilgisi yönetimi (admin_hesap.json)
const ADMIN_HESAP_PATH = path.join(__dirname, 'veritabani', 'admin_hesap.json');
const BEKLEYEN_YAZILAR_PATH = path.join(__dirname, 'veritabani', 'bekleyen_yazilar.json');

function getAdminHesap() {
    if (fs.existsSync(ADMIN_HESAP_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(ADMIN_HESAP_PATH, 'utf8'));
            if (data && data.username && data.password) {
                return data;
            }
        } catch (e) {
            console.error("admin_hesap.json okuma hatası:", e);
        }
    }
    const defaultAcc = { username: 'erdem.ozkur', password: 'erdem.123' };
    try {
        fs.writeFileSync(ADMIN_HESAP_PATH, JSON.stringify(defaultAcc, null, 2), 'utf8');
    } catch (e) {}
    return defaultAcc;
}

function getBekleyenYazilar() {
    if (!fs.existsSync(BEKLEYEN_YAZILAR_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(BEKLEYEN_YAZILAR_PATH, 'utf8')) || [];
    } catch (e) {
        return [];
    }
}

function saveBekleyenYazilar(liste) {
    try {
        fs.writeFileSync(BEKLEYEN_YAZILAR_PATH, JSON.stringify(liste, null, 2), 'utf8');
    } catch (e) {
        console.error('bekleyen_yazilar.json kaydetme hatası:', e);
    }
}

/* ── ROLLER (2026-08-08) ────────────────────────────────────────────────────
   Rol, yazar kaydındaki `rol` alanında tutulur; alan yoksa 'yazar' sayılır.
   admin_hesap.json'daki ana yönetici her zaman 'yonetici'dir.

     yonetici : her şey (rol atama dâhil)
     denetim  : yazı onaylayıp reddedebilir — AMA KENDİ yazısını göremez ve
                onaylayamaz (çıkar çatışması); ayrıca kendi kitapçığını
                normal yazar gibi düzenler
     yazar    : yalnızca kendi yazılarını gönderir/düzenler
     okuyucu  : yalnızca okur; yazı gönderemez, düzenleyemez
*/
const ROLLER = ['yonetici', 'denetim', 'yazar', 'okuyucu'];

function rolNormalize(r) {
    const x = (r || '').trim().toLowerCase();
    return ROLLER.includes(x) ? x : 'yazar';
}

/* Kimlik + rol çözümlemesi. Başarısızsa null döner.
   { rol, yazar }  → yazar, ana yönetici girişinde null olabilir. */
function kimlikCozumle(username, password) {
    if (yoneticiMi(username, password)) {
        const kayit = yazarKaydiBul(username);
        return { rol: 'yonetici', yazar: kayit, yazarAdi: kayit ? kayit.name : null };
    }

    const uName = (username || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    const db = veritabaniOku();
    if (!db) return null;

    const kayit = db.find(a =>
        (a.username || '').trim().toLowerCase() === uName &&
        (a.password || 'mektep123') === pwd
    );
    if (!kayit) return null;

    return { rol: rolNormalize(kayit.rol), yazar: kayit, yazarAdi: kayit.name };
}

function veritabaniOku() {
    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
    if (!fs.existsSync(dbPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        return null;
    }
}

function yazarKaydiBul(username) {
    const db = veritabaniOku();
    if (!db) return null;
    const uName = (username || '').trim().toLowerCase();
    return db.find(a => (a.username || '').trim().toLowerCase() === uName) || null;
}

// Onay/red yetkisi: yönetici ve denetim. Denetim KENDİ yazısına dokunamaz.
function onaylayabilirMi(kimlik, gonderiYazarAdi) {
    if (!kimlik) return false;
    if (kimlik.rol === 'yonetici') return true;
    if (kimlik.rol !== 'denetim') return false;
    const kendi = (kimlik.yazarAdi || '').toLocaleUpperCase('tr');
    return kendi !== (gonderiYazarAdi || '').toLocaleUpperCase('tr');
}

/* Yazar kimlik doğrulaması. Başarılıysa veritabanındaki yazar kaydını,
   değilse null döner. Kullanıcı adı VEYA görünen ad ile eşleşmeye izin verir
   (/api/author-submit-article'daki mevcut davranışla aynı).
   Yönetici de bir yazar adına işlem yapabilsin diye admin kimliği kabul edilir;
   o durumda hedef yazar `authorName` ile bulunur. */
function yazarDogrula(username, password, authorName) {
    const uName = (username || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    const hedefAd = (authorName || '').trim();

    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
    if (!fs.existsSync(dbPath)) return null;

    let db;
    try {
        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        return null;
    }

    if (yoneticiMi(username, password)) {
        return db.find(a => (a.name || '').trim().toLocaleUpperCase('tr') === hedefAd.toLocaleUpperCase('tr')) || null;
    }

    return db.find(a =>
        ((a.username || '').trim().toLowerCase() === uName ||
         (a.name || '').trim().toLocaleUpperCase('tr') === hedefAd.toLocaleUpperCase('tr')) &&
        (a.password || 'mektep123') === pwd
    ) || null;
}

function yoneticiMi(username, password) {
    const u = (username || '').trim().toLowerCase();
    const p = (password || '').trim();
    const adminAcc = getAdminHesap();
    const validUsernames = [(adminAcc.username || '').toLowerCase(), 'erdem.ozkur', 'admin', 'yonetici', 'mektep'];
    const validPasswords = [adminAcc.password, 'erdem.123', 'admin123', 'mektep123'];
    return validUsernames.includes(u) && validPasswords.includes(p);
}

/* ── Yinelenen başlık kuralı (2026-08-06) ──────────────────────────────────
   Kullanıcı kuralı: "bir yazarda aynı başlıktan iki tane varsa tek bir tanesini
   referans alsın." Yinelenme iki yoldan doğuyordu: (1) scrape.js yalnızca URL'e
   bakıyordu, aynı yazı farklı adresle yeniden yayımlanınca ikinci kez ekleniyordu
   (veritabanında EMİN KEVEN'de böyle bir çift vardı), (2) elle yazı girişi.
   Karşılaştırma Türkçe'ye duyarlı yapılır (İ/I, büyük harf) ve fazla boşluklar
   sadeleştirilir; ilk kayıt korunur, sonrakiler atılır. */
function basligiNormalize(baslik) {
    return (baslik || '')
        // Kesme/tırnak işaretleri kopyala-yapıştırda sürekli değişiyor
        // ('’‘ ile " “ ” gibi) — hepsi tek biçime indirgenir.
        .replace(/[‘’ʼ´`]/g, "'")
        .replace(/[“”«»]/g, '"')
        // Aksanları ayır ve at. Bu, hem "İ/I/i" karmaşasını hem de büyük/küçük
        // harf dönüşümlerinden artakalan başıboş birleşen noktayı (U+0307)
        // ortadan kaldırır — testte "LİYAKAT" başlığı, küçük harfe çevrilip
        // tekrar büyütüldüğünde "Lİ̇YAKAT" olup eşleşmiyordu. Aksanlar atıldığı
        // için karşılaştırma "SAĞ"/"SAG" gibi yazım farklarına da dayanıklı.
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function tekilBasliklar(articles) {
    const gorulen = new Set();
    const liste = [];
    const atilan = [];
    (articles || []).forEach(art => {
        const anahtar = basligiNormalize(art && art.title);
        if (!anahtar) { liste.push(art); return; }   // başlıksız kaydı olduğu gibi bırak
        if (gorulen.has(anahtar)) { atilan.push(art.title); return; }
        gorulen.add(anahtar);
        liste.push(art);
    });
    return { liste, atilan };
}

// Aynı anda birden fazla tarama başlatılmasını engeller (scrape.js ve build
// script'leri aynı JSON dosyasına yazdığı için paralel çalışma veriyi bozar).
let taramaCalisiyor = false;
// Elle yazı ekleme de aynı JSON'a yazıp aynı build script'lerini çalıştırıyor;
// tarama sürerken yazı eklenmesi (ya da tersi) veriyi bozar.
let yaziEkleniyor = false;

function veritabaniOzeti() {
    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
    if (!fs.existsSync(dbPath)) return { yazar: 0, makale: 0 };
    try {
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        return {
            yazar: db.length,
            makale: db.reduce((t, a) => t + ((a.articles && a.articles.length) || 0), 0)
        };
    } catch (e) {
        return { yazar: 0, makale: 0 };
    }
}

const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Parse URL
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = urlObj.pathname;

    // API: Login Endpoint
    if (req.method === 'POST' && pathname === '/api/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { role, username, password } = data;

                const uName = (username || '').trim().toLowerCase();
                const pwd = (password || '').trim();

                /* ROLÜ SUNUCU BELİRLER (2026-08-08).
                   Eskiden istemci hangi rolle gireceğini kendi seçiyordu
                   (giriş ekranındaki sekme) ve sunucu o seçime göre kontrol
                   yapıyordu. Dört rollü yapıda bu hem yetersiz hem güvensiz:
                   yetki, kimlik bilgisinin kendisinden çıkmalı. `role`
                   parametresi artık yalnızca ESKİ istemcilerle uyum için
                   okunuyor, karara etkisi yok.

                   GERİYE DÖNÜK UYUM — DİKKAT (2026-08-08'de hatalı yapıldı):
                   Sayfalar rolü İngilizce eski adlarıyla kontrol ediyor
                   (userRole === 'admin' / 'author'). İlk denemede yalnızca
                   'yonetici' → 'admin' eşlemesi yapıldı, 'yazar' olduğu gibi
                   döndü; sonuç: kütüphanedeki "yalnızca kendi kitabın" süzgeci,
                   kitapçıktaki Düzenle düğmesi ve PDF/Word indirme sessizce
                   devre dışı kaldı — yazar bütün kitapları görür oldu.
                   Bu yüzden eşleme artık TAM ve tek yerde yapılıyor. */
                const DIS_ROL = {
                    yonetici: 'admin',
                    yazar: 'author',
                    denetim: 'denetim',
                    okuyucu: 'okuyucu'
                };

                const kimlik = kimlikCozumle(username, password);

                if (kimlik) {
                    const disRol = DIS_ROL[kimlik.rol] || 'author';
                    const cevap = { success: true, role: disRol, gercekRol: kimlik.rol };

                    if (kimlik.yazar) {
                        cevap.authorName = kimlik.yazar.name;
                        cevap.authorId = kimlik.yazar.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
                        cevap.username = kimlik.yazar.username || uName;
                    } else {
                        cevap.username = getAdminHesap().username;
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(cevap));
                    return;
                }

                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Kullanıcı adı veya şifre hatalı!' }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Admin Şifre Değiştirme
    if (req.method === 'POST' && pathname === '/api/change-admin-password') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { currentUsername, currentPassword, newUsername, newPassword } = data;

                if (!yoneticiMi(currentUsername, currentPassword)) {
                    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Mevcut yönetici kullanıcı adı veya şifreniz hatalı!' }));
                    return;
                }

                if (!newPassword || newPassword.trim().length < 3) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Yeni şifre en az 3 karakter olmalıdır!' }));
                    return;
                }

                const updatedUsername = (newUsername || currentUsername || 'erdem.ozkur').trim();
                const updatedPassword = newPassword.trim();

                const newAccData = {
                    username: updatedUsername,
                    password: updatedPassword,
                    updatedAt: new Date().toISOString()
                };

                fs.writeFileSync(ADMIN_HESAP_PATH, JSON.stringify(newAccData, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Yönetici kullanıcı adı ve şifresi başarıyla güncellendi.',
                    username: updatedUsername
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Sunucu hatası: ' + e.message }));
            }
        });
        return;
    }

    // API: Admin Bilgisi
    if (req.method === 'GET' && pathname === '/api/get-admin-info') {
        const adminAcc = getAdminHesap();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, username: adminAcc.username }));
        return;
    }

    // API: Yazarın Kendi Sayfasından Yazı Ekleyip Onaya Göndermesi (Kaydet ve Onaya Gönder)
    if (req.method === 'POST' && pathname === '/api/author-submit-article') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { role, username, password, authorName, title, content } = data;

                const uName = (username || '').trim().toLowerCase();
                const pwd = (password || '').trim();
                const baslik = (title || '').trim();
                const icerik = (content || '').replace(/\r\n/g, '\n').trim();
                const yazarAdi = (authorName || '').trim();

                if (!baslik || !icerik) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Lütfen yazı başlığını ve içeriğini doldurun.' }));
                    return;
                }

                const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                let authorRecord = null;
                if (fs.existsSync(dbPath)) {
                    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                    authorRecord = db.find(a => 
                        ((a.username || '').trim().toLowerCase() === uName || (a.name || '').trim().toLocaleUpperCase('tr') === yazarAdi.toLocaleUpperCase('tr')) && 
                        (a.password || 'mektep123') === pwd
                    );
                }

                const isAdmin = yoneticiMi(username, password);

                if (!authorRecord && !isAdmin) {
                    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Kimlik doğrulama başarısız! Lütfen tekrar giriş yapın.' }));
                    return;
                }

                // 'okuyucu' rolü yalnızca okur; yazı gönderemez.
                if (authorRecord && rolNormalize(authorRecord.rol) === 'okuyucu') {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Hesabınız okuyucu yetkisinde. Yazı gönderme yetkiniz bulunmuyor.' }));
                    return;
                }

                const hedefYazarAdi = authorRecord ? authorRecord.name : (yazarAdi || 'YAZAR');
                const bekleyenler = getBekleyenYazilar();

                /* Yalnızca HÂLÂ BEKLEYEN kayıtlara bakılır. Karar verilmiş
                   kayıtlar listede kaldığı için bu filtre olmazsa, reddedilen
                   bir yazı düzeltilip aynı başlıkla tekrar gönderilemezdi. */
                const ayniBekleyen = bekleyenler.find(b =>
                    (b.status || 'pending') === 'pending' &&
                    b.authorName.toLocaleUpperCase('tr') === hedefYazarAdi.toLocaleUpperCase('tr') &&
                    basligiNormalize(b.title) === basligiNormalize(baslik)
                );

                if (ayniBekleyen) {
                    res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Bu başlıktaki bir yazınız zaten yönetici onayında bekliyor.' }));
                    return;
                }

                const yeniBekleyen = {
                    id: 'bekleyen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    authorName: hedefYazarAdi,
                    username: uName,
                    title: baslik,
                    content: icerik,
                    submittedAt: new Date().toISOString(),
                    status: 'pending'
                };

                bekleyenler.push(yeniBekleyen);
                saveBekleyenYazilar(bekleyenler);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Yazınız başarıyla kaydedildi ve yönetici onayına gönderildi. Yönetici onayladıktan sonra e-kitapçığınızda yayınlanacaktır.',
                    id: yeniBekleyen.id
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Sunucu hatası: ' + e.message }));
            }
        });
        return;
    }

    /* API: Yazarın KENDİ gönderdiği yazıların durumu.
       Yazar yalnızca kendi kayıtlarını görür; başkasının gönderisini
       göremez. İçerik de dönülür, çünkü reddedilen yazıyı düzenleme
       kutusuna doldurmak gerekiyor. */
    if (req.method === 'GET' && pathname === '/api/my-submissions') {
        const q = urlObj.searchParams;
        const yazar = yazarDogrula(q.get('username'), q.get('password'), q.get('authorName'));

        if (!yazar) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Kimlik doğrulama başarısız.' }));
            return;
        }

        const benimkiler = getBekleyenYazilar()
            .filter(b => (b.authorName || '').toLocaleUpperCase('tr') === yazar.name.toLocaleUpperCase('tr'))
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, submissions: benimkiler }));
        return;
    }

    /* API: Reddedilen yazıyı düzeltip yeniden onaya gönderme.
       Yeni kayıt AÇILMAZ; aynı kayıt güncellenip tekrar 'pending' yapılır.
       Böylece yazar aynı yazıyı takip etmeye devam eder. Önceki red kararı
       `gecmis` dizisinde saklanır — hangi gerekçeyle kaç kez reddedildiği
       kaybolmasın. */
    if (req.method === 'POST' && pathname === '/api/author-resubmit-article') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const d = JSON.parse(body || '{}');
                const yazar = yazarDogrula(d.username, d.password, d.authorName);

                if (!yazar) {
                    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Kimlik doğrulama başarısız.' }));
                    return;
                }

                if (rolNormalize(yazar.rol) === 'okuyucu') {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Hesabınız okuyucu yetkisinde. Yazı gönderme yetkiniz bulunmuyor.' }));
                    return;
                }

                const baslik = (d.title || '').trim();
                const icerik = (d.content || '').replace(/\r\n/g, '\n').trim();

                if (!baslik || !icerik) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Lütfen başlık ve içeriği doldurun.' }));
                    return;
                }

                const liste = getBekleyenYazilar();
                // Yazar SADECE kendi reddedilmiş yazısını tekrar gönderebilir.
                const kayit = liste.find(b =>
                    b.id === d.id &&
                    (b.authorName || '').toLocaleUpperCase('tr') === yazar.name.toLocaleUpperCase('tr') &&
                    b.status === 'rejected'
                );

                if (!kayit) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Reddedilmiş yazı bulunamadı. Sayfayı yenileyip tekrar deneyin.' }));
                    return;
                }

                if (!Array.isArray(kayit.gecmis)) kayit.gecmis = [];
                kayit.gecmis.push({
                    durum: 'rejected',
                    tarih: kayit.kararTarihi,
                    kararVeren: kayit.kararVeren,
                    redSebebi: kayit.redSebebi || '',
                    eskiBaslik: kayit.title
                });

                kayit.title = baslik;
                kayit.content = icerik;
                kayit.status = 'pending';
                kayit.submittedAt = new Date().toISOString();
                kayit.revizyon = (kayit.revizyon || 1) + 1;
                delete kayit.kararTarihi;
                delete kayit.kararVeren;
                delete kayit.redSebebi;

                saveBekleyenYazilar(liste);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Düzeltilmiş yazınız yeniden yönetici onayına gönderildi.',
                    id: kayit.id
                }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Sunucu hatası: ' + e.message }));
            }
        });
        return;
    }

    /* API: Kullanıcı rollerini listeleme (yalnızca yönetici).
       Şifre DÖNÜLMEZ — panelde gerekmiyor, sızdırmanın anlamı yok. */
    if (req.method === 'GET' && pathname === '/api/roles') {
        const q = urlObj.searchParams;
        const kimlik = kimlikCozumle(q.get('username'), q.get('password'));

        if (!kimlik || kimlik.rol !== 'yonetici') {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Rolleri yalnızca yönetici görebilir.' }));
            return;
        }

        const db = veritabaniOku() || [];
        const liste = db.map(a => ({
            name: a.name,
            username: a.username || '',
            rol: rolNormalize(a.rol),
            yaziSayisi: (a.articles || []).length
        })).sort((x, y) => x.name.localeCompare(y.name, 'tr'));

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, roller: liste, tanimliRoller: ROLLER }));
        return;
    }

    // API: Bir kullanıcının rolünü değiştirme (yalnızca yönetici)
    if (req.method === 'POST' && pathname === '/api/set-role') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const d = JSON.parse(body || '{}');
                const kimlik = kimlikCozumle(d.username, d.password);

                if (!kimlik || kimlik.rol !== 'yonetici') {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Rol atamayı yalnızca yönetici yapabilir.' }));
                    return;
                }

                const yeniRol = (d.rol || '').trim().toLowerCase();
                if (!ROLLER.includes(yeniRol)) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Geçersiz rol. Geçerli roller: ' + ROLLER.join(', ') }));
                    return;
                }

                const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                const db = veritabaniOku();
                if (!db) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Veritabanı okunamadı.' }));
                    return;
                }

                const hedef = db.find(a => (a.name || '').trim().toLocaleUpperCase('tr') === (d.hedefAd || '').trim().toLocaleUpperCase('tr'));
                if (!hedef) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Kullanıcı bulunamadı.' }));
                    return;
                }

                hedef.rol = yeniRol;
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: `${hedef.name} → ${yeniRol}` }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Sunucu hatası: ' + e.message }));
            }
        });
        return;
    }

    // API: Yönetici İçin Onay Bekleyen Yazıları Listeleme
    if (req.method === 'GET' && pathname === '/api/pending-articles') {
        const urlParams = urlObj.searchParams;
        const u = urlParams.get('username') || '';
        const p = urlParams.get('password') || '';

        const kimlik = kimlikCozumle(u, p);

        if (!kimlik || (kimlik.rol !== 'yonetici' && kimlik.rol !== 'denetim')) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Bu veriyi yalnızca yönetici ve denetim yetkisi olanlar görebilir.' }));
            return;
        }

        let bekleyenler = getBekleyenYazilar();

        /* ÇIKAR ÇATIŞMASI: denetim yetkisi olan kişi de bir yazardır ve kendi
           yazısını gönderebilir. Kendi gönderisini onaylamasın diye listeden
           tamamen çıkarılır — göremediğini onaylayamaz. Yönetici hepsini görür. */
        if (kimlik.rol === 'denetim') {
            const kendi = (kimlik.yazarAdi || '').toLocaleUpperCase('tr');
            bekleyenler = bekleyenler.filter(b => (b.authorName || '').toLocaleUpperCase('tr') !== kendi);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, pendingArticles: bekleyenler, rol: kimlik.rol }));
        return;
    }

    // API: Yönetici Onaylama / Reddetme İşlemi
    if (req.method === 'POST' && pathname === '/api/approve-pending-article') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                const { username, password, id, action } = data;

                const kimlik = kimlikCozumle(username, password);

                if (!kimlik || (kimlik.rol !== 'yonetici' && kimlik.rol !== 'denetim')) {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Bu işlemi yalnızca yönetici ve denetim yetkisi olanlar yapabilir.' }));
                    return;
                }

                if (taramaCalisiyor || yaziEkleniyor) {
                    res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Şu anda başka bir güncelleme işlemi sürüyor. Lütfen bekleyin.' }));
                    return;
                }

                const bekleyenler = getBekleyenYazilar();
                /* Yalnızca HÂLÂ BEKLEYEN kayıt işlenebilir. Karar verilmiş kayıtlar
                   artık listede kaldığı için (geçmiş görünsün diye) bu filtre
                   olmazsa aynı yazı ikinci kez onaylanıp kitapçığa iki kez
                   eklenebilirdi. */
                const itemIndex = bekleyenler.findIndex(b => b.id === id && (b.status || 'pending') === 'pending');

                if (itemIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Onay bekleyen yazı bulunamadı veya daha önce işlenmiş.' }));
                    return;
                }

                const targetItem = bekleyenler[itemIndex];

                /* ÇIKAR ÇATIŞMASI KAPISI — listeleme zaten kendi yazısını
                   gizliyor, ama bu asıl koruma: kimliği doğrudan bu uç noktaya
                   istek atarak listeyi atlayamasın. Kimse kendi yazısını
                   onaylayamaz/reddedemez. */
                if (!onaylayabilirMi(kimlik, targetItem.authorName)) {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Kendi yazınızı onaylayamaz veya reddedemezsiniz. Bu yazıyı başka bir yetkili değerlendirmelidir.' }));
                    return;
                }

                if (action === 'reject') {
                    /* Reddedilen yazı SİLİNMİYOR — yazar durumunu görebilsin ve
                       düzeltip tekrar gönderebilsin diye kayıt korunuyor. */
                    targetItem.status = 'rejected';
                    targetItem.kararTarihi = new Date().toISOString();
                    targetItem.kararVeren = (username || '').trim();
                    targetItem.redSebebi = ((data.redSebebi || '') + '').trim();
                    saveBekleyenYazilar(bekleyenler);

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: `"${targetItem.title}" başlıklı yazı reddedildi. Yazar durumu görüp düzeltilmiş hâlini tekrar gönderebilir.` }));
                    return;
                }

                if (action === 'approve') {
                    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                    let db;
                    try {
                        db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                    } catch (e) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, message: 'Veritabanı okunamadı.' }));
                        return;
                    }

                    const yazarAdi = targetItem.authorName;
                    const idx = db.findIndex(a => (a.name || '').trim().toLocaleUpperCase('tr') === yazarAdi.toLocaleUpperCase('tr'));

                    if (idx === -1) {
                        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, message: `"${yazarAdi}" veritabanında bulunamadı.` }));
                        return;
                    }

                    yaziEkleniyor = true;

                    if (!db[idx].articles) db[idx].articles = [];

                    const ayniBaslikIndex = db[idx].articles.findIndex(art => basligiNormalize(art.title) === basligiNormalize(targetItem.title));

                    if (ayniBaslikIndex !== -1) {
                        db[idx].articles[ayniBaslikIndex].content = targetItem.content;
                        if (targetItem.submittedAt) db[idx].articles[ayniBaslikIndex].date = targetItem.submittedAt.split('T')[0];
                    } else {
                        db[idx].articles.push({
                            title: targetItem.title,
                            date: targetItem.submittedAt ? targetItem.submittedAt.split('T')[0] : new Date().toISOString().split('T')[0],
                            url: '',
                            content: targetItem.content
                        });
                    }

                    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

                    /* Onaylanan yazı da SİLİNMİYOR — yönetici panelinde "kim,
                       neyi, ne zaman onayladı" geçmişi görünsün diye kayıt
                       durumu işaretlenerek korunuyor. */
                    targetItem.status = 'approved';
                    targetItem.kararTarihi = new Date().toISOString();
                    targetItem.kararVeren = (username || '').trim();
                    saveBekleyenYazilar(bekleyenler);

                    /* SIRA ÖNEMLİ: generate_pdf_kit.js önce çalışmalı — kitapçık
                       PDF'lerini üretirken veritabanına sayfa/İçindekiler bilgisi
                       de yazıyor. build_library.js sonra çalışıp o zenginleşmiş
                       veritabanından istatistikleri ve sayfaları üretiyor.
                       2026-08-08: burada sıra TERSTİ (önce build_library) — bu
                       yüzden onaylanan yazı ne kitapçığa ne de istatistiklere
                       yansıyordu. Diğer çağrılardaki (satır ~758) doğru kalıba
                       eşitlendi; maxBuffer da eklendi, 60 yazarın çıktısı
                       varsayılan 1 MB tamponu taşırıyor. */
                    const onayBaslangic = Date.now();
                    console.log(`▶ Onay: ${db[idx].name} — "${targetItem.title}". Kitapçık yeniden üretiliyor...`);

                    yenidenUret(db[idx].name, (err, stderr) => {
                        yaziEkleniyor = false;
                        const saniye = Math.round((Date.now() - onayBaslangic) / 1000);

                        if (err) {
                            console.error('Onay sonrası kitapçık üretimi başarısız:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({
                                success: false,
                                message: 'Yazı veritabanına kaydedildi ama kitapçıklar yeniden üretilemedi.',
                                detay: (stderr || err.message || '').slice(0, 500)
                            }));
                            return;
                        }

                        console.log(`✓ Onay tamamlandı (${saniye} sn).`);
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({
                            success: true,
                            message: `"${targetItem.title}" başlıklı yazı onaylandı, veritabanına kaydedildi ve kütüphanede yayınlandı!`
                        }));
                    });
                    return;
                }

                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Geçersiz eylem.' }));

            } catch (e) {
                yaziEkleniyor = false;
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, message: 'Sunucu hatası: ' + e.message }));
            }
        });
        return;
    }

    // API: Webden Canlı Güncelle (tarama + yeniden derleme)
    if (req.method === 'POST' && pathname === '/api/sync') {
        // web sayfası standalone olduğu için tarama ve build işlemleri burada yapılamaz.
        // Yazı eklendiğinde otomatik build zaten yapılır; manuel senkronizasyon gerekirse
        // KAYNAK-ARAÇLAR/ klasöründen build_library.js çalıştırılmalıdır.
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Manuel senkronizasyon desteklenmiyor. İstatistikler yazı eklendiğinde otomatik güncelleniyor.' }));
        return;
    }

    // API: Update Password & Username Endpoint
    if (req.method === 'POST' && pathname === '/api/update-password') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { role, username, password, targetAuthorName, newUsername, newPassword } = data;

                if (!targetAuthorName || !newUsername || !newPassword) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Eksik bilgi: targetAuthorName, newUsername veya newPassword belirtilmedi.' }));
                    return;
                }

                // 1. Read database
                const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                if (!fs.existsSync(dbPath)) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Veritabanı dosyası bulunamadı.' }));
                    return;
                }

                const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

                // 2. Authenticate requester
                let isAuthorized = false;
                if (role === 'admin') {
                    if (yoneticiMi(username, password)) {
                        isAuthorized = true;
                    }
                } else if (role === 'author') {
                    // An author can only update their own credentials
                    const requestingAuthor = db.find(a => a.username === username.trim().toLowerCase() && a.password === password.trim());
                    if (requestingAuthor && requestingAuthor.name.trim().toUpperCase() === targetAuthorName.trim().toUpperCase()) {
                        isAuthorized = true;
                    }
                }

                if (!isAuthorized) {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Yetkisiz işlem! Geçersiz kimlik bilgileri.' }));
                    return;
                }

                // 3. Find target author
                const author = db.find(a => a.name.trim().toUpperCase() === targetAuthorName.trim().toUpperCase());
                if (!author) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: `Yazar ${targetAuthorName} bulunamadı.` }));
                    return;
                }

                // 4. Check if new username is already taken by someone else
                const cleanNewUsername = newUsername.trim().toLowerCase();
                const isTaken = db.some(a => a.name !== author.name && a.username === cleanNewUsername);
                if (isTaken) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Bu kullanıcı adı zaten başka bir yazar tarafından kullanılıyor!' }));
                    return;
                }

                // 5. Update credentials
                author.username = cleanNewUsername;
                author.password = newPassword.trim();

                // 6. Save database
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
                console.log(`✓ Credentials updated for author: ${targetAuthorName}`);

                // 7. Rebuild library
                exec('node build_library.js', { cwd: __dirname }, (err, stdout, stderr) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, error: 'Kütüphane oluşturulurken hata oluştu.' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                });

            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // API: Save Articles Endpoint
    /* API: Yönetici panelinden ELLE YAZI EKLEME (2026-08-06)
       Site taraması bazen yeni yazıyı getirmiyor; yönetici o yazıyı buradan
       kendisi girebiliyor. Yazı seçilen yazarın listesinin SONUNA ekleniyor —
       yani mevcut kitabın devamı olarak, tıpkı taramanın eklediği gibi.
       Aynı başlık zaten varsa yeni kayıt AÇILMAZ: varsayılan olarak 409 ile
       uyarılır, yönetici onaylarsa (uzerineYaz) mevcut kayıt güncellenir. */
    if (req.method === 'POST' && pathname === '/api/add-article') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            let data = {};
            try { data = JSON.parse(body || '{}'); } catch (e) { data = {}; }

            if (!yoneticiMi(data.username, data.password) || data.role !== 'admin') {
                res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Yazı eklemeyi yalnızca yönetici yapabilir. Lütfen tekrar giriş yapın.' }));
                return;
            }

            if (taramaCalisiyor || yaziEkleniyor) {
                res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Şu anda başka bir güncelleme işleniyor. Lütfen bitmesini bekleyin.' }));
                return;
            }

            const yazarAdi = (data.authorName || '').trim();
            const baslik = (data.title || '').trim();
            const icerik = (data.content || '').replace(/\r\n/g, '\n').trim();

            if (!yazarAdi || !baslik || !icerik) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Yazar, başlık ve içerik alanlarının üçü de dolu olmalı.' }));
                return;
            }

            const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
            let db;
            try {
                db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Veritabanı okunamadı: ' + e.message }));
                return;
            }

            const idx = db.findIndex(a => (a.name || '').trim().toLocaleUpperCase('tr') === yazarAdi.toLocaleUpperCase('tr'));
            if (idx === -1) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: `"${yazarAdi}" veritabanında bulunamadı.` }));
                return;
            }

            const yazar = db[idx];
            if (!Array.isArray(yazar.articles)) yazar.articles = [];

            // Başlıklar kitap üretiminde zaten büyük harfe çevriliyor
            // (generate_pdf_kit.js); burada da aynısını yaparak listenin
            // tamamını tek biçimde tutuyoruz.
            const baslikBuyuk = baslik.toLocaleUpperCase('tr');
            const anahtar = basligiNormalize(baslikBuyuk);
            const mevcutIdx = yazar.articles.findIndex(a => basligiNormalize(a.title) === anahtar);

            if (mevcutIdx !== -1 && !data.uzerineYaz) {
                res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: false,
                    yinelenen: true,
                    error: `"${yazar.name}" yazarında bu başlıkta bir yazı zaten var (${mevcutIdx + 1}. sıra). Aynı başlıktan ikinci bir kayıt açılmaz.`
                }));
                return;
            }

            const simdi = new Date();
            const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
            const yeniYazi = {
                title: baslikBuyuk,
                // Tarih kitapta BASILMIYOR (2026-08-06'da kaldırıldı) ama veri
                // alanı yönetim/düzenleme ekranlarında hâlâ kullanılıyor.
                date: (data.date || '').trim() || `${simdi.getDate()}-${aylar[simdi.getMonth()]}-${simdi.getFullYear()}`,
                // Elle girilen yazının kaynak adresi yok; scrape.js'in URL'e
                // bakan yinelenme kontrolü bu kaydı ASLA eşleştirmemeli, bu
                // yüzden benzersiz bir yerel işaret veriliyor.
                url: 'elle-girildi://' + yazar.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '/' + Date.now(),
                content: icerik,
                elleGirildi: true
            };

            let islem;
            if (mevcutIdx !== -1) {
                // Üzerine yazma: sırasını ve varsa özgün url/tarihini koru.
                const eski = yazar.articles[mevcutIdx];
                yazar.articles[mevcutIdx] = { ...eski, title: baslikBuyuk, content: icerik, elleGirildi: true };
                islem = 'guncellendi';
            } else {
                yazar.articles.push(yeniYazi);
                islem = 'eklendi';
            }

            // Yazarın listesinde önceden kalmış yinelenen başlıklar varsa
            // (tarama kaynaklı) bu yazma sırasında temizlenir.
            const { liste, atilan } = tekilBasliklar(yazar.articles);
            yazar.articles = liste;

            try {
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Veritabanına yazılamadı: ' + e.message }));
                return;
            }

            yaziEkleniyor = true;
            const baslangic = Date.now();
            console.log(`▶ Elle yazı ${islem}: ${yazar.name} — "${baslikBuyuk}". Kitapçık yeniden üretiliyor...`);

            yenidenUret(yazar.name, (err, stderr) => {
                yaziEkleniyor = false;
                const saniye = Math.round((Date.now() - baslangic) / 1000);

                if (err) {
                    console.error('Kitapçık üretimi başarısız:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Yazı veritabanına kaydedildi ama kitapçıklar yeniden üretilemedi.',
                        detay: (stderr || err.message || '').slice(0, 500)
                    }));
                    return;
                }

                console.log(`✓ Tamamlandı (${saniye} sn).`);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    islem,
                    yazar: yazar.name,
                    baslik: baslikBuyuk,
                    yaziSayisi: yazar.articles.length,
                    temizlenenYinelenen: atilan,
                    saniye
                }));
            });
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/api/save-articles') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { authorRealName, articles, role, username, password } = data;

                if (!authorRealName || !articles) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing authorRealName or articles' }));
                    return;
                }

                // Verify credentials
                let authorized = false;
                if (role === 'admin') {
                    // Eskiden burada katı `username==='admin' && password==='admin123'`
                    // kontrolü vardı; /api/login esnek liste kabul ettiği için
                    // "yonetici/mektep123" ile giren yönetici burada 403 alıyordu.
                    if (yoneticiMi(username, password)) authorized = true;
                } else if (role === 'author') {
                    const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                    if (fs.existsSync(dbPath)) {
                        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                        const author = db.find(a => a.name === authorRealName);
                        if (author && author.username === username && author.password === password) {
                            authorized = true;
                        }
                    }
                }

                if (!authorized) {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Bu işlemi yapmaya yetkiniz yok! Lütfen tekrar giriş yapın.' }));
                    return;
                }

                // 1. Read database
                const dbPath = path.join(__dirname, 'veritabani', 'yazarlar_veritabani.json');
                const dbContent = fs.readFileSync(dbPath, 'utf8');
                const db = JSON.parse(dbContent);

                // 2. Find and update the author
                const authorIndex = db.findIndex(a => a.name.trim().toUpperCase() === authorRealName.trim().toUpperCase());
                if (authorIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Author ${authorRealName} not found in database` }));
                    return;
                }

                // Aynı başlıktan iki kayıt kuralı burada da geçerli: tam kitap
                // düzenleyicisinde bir başlık kopyalanmışsa ilki korunur.
                const { liste: tekilListe } = tekilBasliklar(articles);
                db[authorIndex].articles = tekilListe;

                // 3. Write back to database
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
                console.log(`✓ Database updated for author: ${authorRealName}`);

                // 4. Run scripts sequentially to regenerate PDFs and rebuilding library
                console.log('Regenerating PDFs and rebuilding library...');
                yenidenUret(db[authorIndex].name, (err, stderr) => {
                    if (err) {
                        console.error('Error running build scripts:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to regenerate PDFs', details: stderr }));
                        return;
                    }
                    console.log('✓ Rebuild complete.');

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });

            } catch (e) {
                console.error(e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process request', details: e.message }));
            }
        });
        return;
    }

    // Serve static files
    // Decode URI to handle spaces/Turkish characters in file paths
    let safePathname = decodeURIComponent(pathname);
    if (safePathname === '/' || safePathname === '') {
        safePathname = '/login.html';
    }

    const filePath = path.join(WEB_KOK, safePathname);

    // Simple security check to prevent directory traversal
    if (!filePath.startsWith(WEB_KOK)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    /* ── DIŞARI AÇILMAYACAK DOSYALAR (2026-08-08) ───────────────────────────
       Statik servis, klasördeki HER dosyayı olduğu gibi veriyordu. Sitede
       şunlar tarayıcıdan indirilebiliyordu:
         • veritabani/yazarlar_veritabani.json → 61 yazarın kullanıcı adı VE
           açık şifresi
         • server.js → varsayılan yönetici parolası kaynak kodda yazılı
         • bekleyen_yazilar.json → henüz yayımlanmamış yazı metinleri
       Adresi bilen herkes istediği yazar olarak giriş yapabiliyordu.

       Not: flipbook, yazar adı ve yazı listesi için veritabanını tarayıcıdan
       ÇEKİYOR; bu yüzden dosya tümden kapatılamaz. Aşağıda kimlik alanları
       ayıklanmış bir kopyası sunuluyor — flipbook çalışmaya devam ediyor. */
    const istenen = safePathname.replace(/^\/+/, '');

    if (istenen === 'veritabani/yazarlar_veritabani.json') {
        fs.readFile(path.join(WEB_KOK, 'veritabani', 'yazarlar_veritabani.json'), 'utf8', (err, ham) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('File Not Found');
                return;
            }
            try {
                const temiz = JSON.parse(ham).map(({ username, password, ...kalan }) => kalan);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(temiz));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Database read error');
            }
        });
        return;
    }

    const GIZLI_DOSYALAR = new Set([
        'server.js', 'build_library.js', 'generate_pdf_kit.js', 'decode-pdfs.js',
        'package.json', 'package-lock.json', 'vercel.json',
        'Mac_Baslat.command', 'Windows_Baslat.bat'
    ]);

    if (GIZLI_DOSYALAR.has(istenen) || istenen.startsWith('veritabani/') || istenen.startsWith('.')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File Not Found');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('File Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`MEKTEP KÜTÜPHANESİ LOKAL SUNUCUSU BAŞLATILDI`);
    console.log(`Adres: http://localhost:${PORT}`);
    console.log(`===================================================`);
    
    // Auto update database accounts
    dbKullaniciGuncelle();

    // Automatically open browser to the login page
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${startCmd} http://localhost:${PORT}/login.html`);
});
