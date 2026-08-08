const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// Statik dosyaların kökü. server.js zaten web sayfası/ içinde, __dirname doğrudan burada.
const WEB_KOK = __dirname;

// MIME types lookup
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
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
    const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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
            exec('node build_library.js', { cwd: __dirname }, (err, stdout) => {
                if (!err) console.log("✓ Kütüphane yeni kimlik bilgileriyle yeniden oluşturuldu.");
            });
        }
    } catch(e) {
        console.error("Kullanıcı güncellerken hata oluştu:", e);
    }
}

// Yönetici kimlik bilgisi yönetimi (admin_hesap.json)
const ADMIN_HESAP_PATH = path.join(__dirname, 'admin_hesap.json');
const BEKLEYEN_YAZILAR_PATH = path.join(__dirname, 'bekleyen_yazilar.json');

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
    const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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

                if (role === 'admin') {
                    if (yoneticiMi(username, password)) {
                        const adminAcc = getAdminHesap();
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: true, role: 'admin', username: adminAcc.username }));
                        return;
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ success: false, message: 'Hatalı yönetici kullanıcı adı veya şifre!' }));
                        return;
                    }
                } else if (role === 'author') {
                    const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
                    if (fs.existsSync(dbPath)) {
                        const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                        const author = db.find(a => (a.username || nameToUsername(a.name)) === uName && (a.password || 'mektep123') === pwd);
                        if (author) {
                            const safeName = author.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
                            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ success: true, role: 'author', authorName: author.name, authorId: safeName }));
                            return;
                        }
                    }
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

                const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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

                const hedefYazarAdi = authorRecord ? authorRecord.name : (yazarAdi || 'YAZAR');
                const bekleyenler = getBekleyenYazilar();

                const ayniBekleyen = bekleyenler.find(b => 
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

    // API: Yönetici İçin Onay Bekleyen Yazıları Listeleme
    if (req.method === 'GET' && pathname === '/api/pending-articles') {
        const urlParams = urlObj.searchParams;
        const u = urlParams.get('username') || '';
        const p = urlParams.get('password') || '';

        if (!yoneticiMi(u, p)) {
            res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: 'Bu veriyi yalnızca yönetici görebilir.' }));
            return;
        }

        const bekleyenler = getBekleyenYazilar();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, pendingArticles: bekleyenler }));
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

                if (!yoneticiMi(username, password)) {
                    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Bu işlemi yalnızca yönetici yapabilir.' }));
                    return;
                }

                if (taramaCalisiyor || yaziEkleniyor) {
                    res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Şu anda başka bir güncelleme işlemi sürüyor. Lütfen bekleyin.' }));
                    return;
                }

                const bekleyenler = getBekleyenYazilar();
                const itemIndex = bekleyenler.findIndex(b => b.id === id);

                if (itemIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, message: 'Onay bekleyen yazı bulunamadı veya daha önce işlenmiş.' }));
                    return;
                }

                const targetItem = bekleyenler[itemIndex];

                if (action === 'reject') {
                    bekleyenler.splice(itemIndex, 1);
                    saveBekleyenYazilar(bekleyenler);

                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: `"${targetItem.title}" başlıklı yazı reddedildi ve listeden kaldırıldı.` }));
                    return;
                }

                if (action === 'approve') {
                    const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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

                    bekleyenler.splice(itemIndex, 1);
                    saveBekleyenYazilar(bekleyenler);

                    exec('node build_library.js && node generate_pdf_kit.js', { cwd: __dirname }, (err, stdout, stderr) => {
                        yaziEkleniyor = false;
                        if (err) {
                            console.error('Derleme hatası:', err);
                        }
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
                const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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

            const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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
            console.log(`▶ Elle yazı ${islem}: ${yazar.name} — "${baslikBuyuk}". Kitapçıklar yeniden üretiliyor...`);

            exec('node generate_pdf_kit.js && node build_library.js', {
                cwd: __dirname,
                maxBuffer: 50 * 1024 * 1024
            }, (err, stdout, stderr) => {
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
                    const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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
                const dbPath = path.join(__dirname, 'yazarlar_veritabani.json');
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
                exec('node generate_pdf_kit.js && node build_library.js', { cwd: __dirname }, (err, stdout, stderr) => {
                    if (err) {
                        console.error('Error running build scripts:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to regenerate PDFs', details: stderr }));
                        return;
                    }
                    console.log(stdout);
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
