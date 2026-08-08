const fs = require('fs');
const path = require('path');

const KITAP_ESIGI = 1;

function expandAuthorsByVolume(authorsList) {
    const expanded = [];
    // Bir kitabın kaç yazıdan oluştuğu — hem gerçek kitapçık bölünmesi hem de
    // rozet/"N Kitap" göstergesi bu TEK sayıya göre hesaplanır (sayfa sayısı
    // değil, çünkü sayfa sayıları yazıdan yazıya değişebilir).
    const MAX_ARTICLES_PER_BOOK = 40;

    authorsList.forEach(author => {
        if (!author.articles || author.articles.length === 0) {
            expanded.push(author);
            return;
        }

        const totalArticles = author.articles.length;
        if (totalArticles <= MAX_ARTICLES_PER_BOOK) {
            expanded.push({ ...author, rawAuthorName: author.name, volumeIndex: 1, totalVolumes: 1, volumeComplete: true, totalArticleCount: totalArticles });
        } else {
            const volumeCount = Math.ceil(totalArticles / MAX_ARTICLES_PER_BOOK);
            for (let v = 0; v < volumeCount; v++) {
                const startIdx = v * MAX_ARTICLES_PER_BOOK;
                const endIdx = Math.min(startIdx + MAX_ARTICLES_PER_BOOK, totalArticles);
                const volumeArticles = author.articles.slice(startIdx, endIdx);

                // Kapak/isim üzerinde cilt numarası YAZILMAZ — isim her zaman çıplak
                // kalır. Numaralandırma yalnızca kapağın ALTINDA, kitap tamamlandığında
                // (40 makaleye ulaştığında) gösterilir (bkz. createLibraryHTML).
                expanded.push({
                    ...author,
                    rawAuthorName: author.name,
                    volumeIndex: v + 1,
                    totalVolumes: volumeCount,
                    volumeComplete: volumeArticles.length >= MAX_ARTICLES_PER_BOOK,
                    totalArticleCount: totalArticles,
                    articles: volumeArticles
                });
            }
        }
    });

    return expanded;
}

function mergeAuthorsWithTitles(authorsList) {
    const KNOWN_PREFIXES = [
        'PROF. DR.', 'DOÇ. DR.', 'DR.', 'DOC.', 'DOÇ.', 'PROF.', 'AV.', 'UZM.', 'MÜF.', 'ÖĞR. GÖR.', 'ARŞ. GÖR.'
    ];

    function getBaseCoreName(name) {
        let clean = (name || '').trim().toLocaleUpperCase('tr');
        for (let p of KNOWN_PREFIXES) {
            if (clean.startsWith(p)) {
                clean = clean.substring(p.length).trim();
            }
        }
        return clean.replace(/^[\s\.\-]+/, '').trim();
    }

    function getTitlePriority(name) {
        let clean = (name || '').trim().toLocaleUpperCase('tr');
        for (let i = 0; i < KNOWN_PREFIXES.length; i++) {
            if (clean.startsWith(KNOWN_PREFIXES[i])) {
                return KNOWN_PREFIXES.length - i;
            }
        }
        return 0;
    }

    const grouped = {};
    authorsList.forEach(author => {
        const base = getBaseCoreName(author.name);
        if (!grouped[base]) grouped[base] = [];
        grouped[base].push(author);
    });

    const result = [];
    Object.keys(grouped).forEach(base => {
        const list = grouped[base];
        if (list.length === 1) {
            result.push(list[0]);
        } else {
            list.sort((a, b) => {
                const pA = getTitlePriority(a.name);
                const pB = getTitlePriority(b.name);
                if (pA !== pB) return pB - pA;
                return (b.articles ? b.articles.length : 0) - (a.articles ? a.articles.length : 0);
            });

            const primaryAuthor = JSON.parse(JSON.stringify(list[0]));
            if (!primaryAuthor.articles) primaryAuthor.articles = [];

            for (let i = 1; i < list.length; i++) {
                const other = list[i];
                if (other.articles) {
                    other.articles.forEach(art => {
                        const exists = primaryAuthor.articles.some(
                            pArt => pArt.title.trim().toLocaleUpperCase('tr') === art.title.trim().toLocaleUpperCase('tr')
                        );
                        if (!exists) {
                            primaryAuthor.articles.push(art);
                        }
                    });
                }
                if (!primaryAuthor.username && other.username) primaryAuthor.username = other.username;
                if (!primaryAuthor.password && other.password) primaryAuthor.password = other.password;
            }

            result.push(primaryAuthor);
        }
    });

    return result;
}

function createLibraryHTML(rawAuthorsList) {
    const rawAuthors = mergeAuthorsWithTitles(rawAuthorsList);
    let authorCards = '';

    // Kullanıcı adı → gerçek yazar adı/kimlik eşlemesi. Yazar girişinde
    // login.html sadece şifre kontrolü yapıyor (gerçek adı bilmiyor), bu
    // yüzden kütüphane sayfası kendi kartlarını bulurken TAHMİNE değil bu
    // gerçek veritabanı eşlemesine güvenmeli — aksi halde "kemal.tunc" gibi
    // Türkçe karakter içermeyen kullanıcı adları "KEMAL TUNÇ" gerçek adıyla
    // eşleşemiyor (Ç harfi sanitize edilince farklı sonuç veriyor).
    const yazarKimlikleri = {};
    rawAuthors.forEach(a => {
        if (!a.username) return;
        yazarKimlikleri[a.username.trim().toLocaleLowerCase('tr')] = {
            name: a.name,
            id: a.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
        };
    });

    const authors = expandAuthorsByVolume(rawAuthors);
    const adaylar = authors.filter(a => a.articles && a.articles.length >= 1);

    // Aynı yazarın birden çok kitabı (cildi) varsa kartlar yan yana, sırayla
    // dursun diye yazar bazında grupla; gruplar arasında sıralama toplam yazı
    // sayısına göre yapılır.
    const gruplar = [];
    const grupSirasi = new Map();
    adaylar.forEach(a => {
        const anahtar = a.rawAuthorName || a.name;
        if (!grupSirasi.has(anahtar)) {
            grupSirasi.set(anahtar, gruplar.length);
            gruplar.push({ anahtar, volumes: [], toplamYazi: 0 });
        }
        const grup = gruplar[grupSirasi.get(anahtar)];
        grup.volumes.push(a);
        grup.toplamYazi += a.articles.length;
    });
    gruplar.forEach(g => g.volumes.sort((a, b) => (a.volumeIndex || 1) - (b.volumeIndex || 1)));
    gruplar.sort((a, b) => (b.toplamYazi >= KITAP_ESIGI) - (a.toplamYazi >= KITAP_ESIGI)
                          || b.toplamYazi - a.toplamYazi);

    // Tek bir kitap kartının HTML'ini üretir — hem ana rafta (tek kitaplı
    // yazarlarda) hem de çok kitaplı bir yazarın modal penceresi içinde
    // (her cildi ayrı kart olarak) aynı fonksiyon kullanılır.
    function kartUret(author) {
        const n = author.articles.length;
        const kitapOldu = n >= KITAP_ESIGI;
        const cokluCilt = (author.totalVolumes || 1) > 1;
        // Devam kitabı (2. ve sonraki cilt) az yazılı da olsa normal bir kitap
        // gibi AÇILABİLİR/OKUNABİLİR olmalı (3 yazısı olan tek kitaplı bir
        // yazarla aynı muamele) — sadece kendi içinde eşiği (40 yazı)
        // tamamlamadıysa "Kitap N" YAZISI görünmez, kart yine tıklanabilir.
        const basiliMi = kitapOldu;
        const idEki = (author.volumeIndex || 1) > 1 ? `_KITAP${author.volumeIndex}` : '';
        const safeName = (author.name.replace(/[^a-zA-Z0-9]/g, '_') + idEki).toUpperCase();
        const guvenliAd = author.name.replace(/"/g, '&quot;');

        const pageCount = author.pageCount || 0;
        // Rozet ve "N Kitap" sayısı YAZI sayısına göre hesaplanır — sayfa
        // sayıları yazıdan yazıya değiştiği için sayfa bazlı hesap yanıltıcıydı.
        const toplamYazi = author.totalArticleCount || n;
        const bookCount = Math.floor(toplamYazi / 40);

        // Rozet de "Kitap N" etiketiyle AYNI şartla gösterilir: bu cilt kendi
        // içinde eşiği tamamlamadıysa (devam kitabı yarımsa) rozet DE yok —
        // hiçbir kitabı olmayan bir yazardan görsel olarak farkı olmasın.
        let badgeHtml = '';
        if (basiliMi && author.volumeComplete && toplamYazi >= 40) {
            if (toplamYazi >= 120) {
                badgeHtml = `
                <div class="premium-badge" title="Mükemmellik Ödülü: 120+ Yazı Yazarı" style="border-color: #38bdf8; box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);">
                    <span>💎</span>
                    <span style="color: #38bdf8;">Platin (${bookCount} Kitap)</span>
                </div>`;
            } else if (toplamYazi >= 80) {
                badgeHtml = `
                <div class="premium-badge" title="Üstün Başarı Ödülü: 80+ Yazı Yazarı" style="border-color: #fbbf24; box-shadow: 0 0 10px rgba(251, 191, 36, 0.4);">
                    <span>🥇</span>
                    <span style="color: #fbbf24;">Altın (${bookCount} Kitap)</span>
                </div>`;
            } else {
                badgeHtml = `
                <div class="premium-badge" title="Başarı Ödülü: 40+ Yazı Yazarı" style="border-color: #cbd5e1; box-shadow: 0 0 10px rgba(203, 213, 225, 0.3);">
                    <span>🥈</span>
                    <span style="color: #cbd5e1;">Gümüş (${bookCount} Kitap)</span>
                </div>`;
            }
        }

        // "Kitap N" etiketi kapağın ALTINDA gösterilir (üzerine yazılmaz) ve
        // yazarın birden fazla kitabı varsa HER zaman görünür. Yeşil tik (✓)
        // sadece o cilt kendi içinde eşiği (40 makale) tamamladıysa eklenir —
        // tamamlanmamış devam kitabında "Kitap N" yazar ama tik olmaz.
        const kitapEtiketi = cokluCilt
            ? `<div class="kitap-etiketi">Kitap ${author.volumeIndex}${author.volumeComplete ? ' <span class="kitap-tik">✓</span>' : ''}</div>`
            : '';

        // Kitabı yeni sekmede açan bağlantı. Okuyucu hangi kitabı açacağını
        // eskiden yalnızca localStorage'dan okuyordu; localStorage tüm
        // sekmelerde ortak olduğu için ikinci bir kitap açıldığında birincisi
        // bozulurdu. Bu yüzden kitap kimliği adres satırında (?kitap=&ad=)
        // taşınıyor — bkz. flipbook/index.html içindeki AKTIF_KITAP notu.
        const yeniSekmeBtn = basiliMi
            ? `<a class="yeni-sekme-btn" href="flipbook/index.html?kitap=${safeName}&amp;ad=${encodeURIComponent(author.name)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${guvenliAd} — yeni sekmede aç">↗<span class="yeni-sekme-yazi">Yeni sekmede</span></a>`
            : '';

        return `
        <div class="author-card${basiliMi ? '' : ' yakinda'}"${basiliMi ? ` onclick="openFlipbook('${safeName}', this.dataset.name)"` : ''} data-name="${guvenliAd}" data-count="${n}">
            ${yeniSekmeBtn}
            <div class="book-cover">
                <div class="book-spine"></div>
                <div class="cover-author-overlay">
                    <h3 class="cover-author-name">${author.name}</h3>
                </div>
            </div>
            ${kitapEtiketi}
            ${badgeHtml ? `<div style="text-align: center; width: 200px; margin: 0 auto;">${badgeHtml}</div>` : ''}
        </div>`;
    }

    let yazarModallari = '';

    gruplar.forEach((grup) => {
        if (grup.volumes.length === 1) {
            authorCards += kartUret(grup.volumes[0]);
            return;
        }

        // Çok kitaplı yazar: ana rafta diğerleri gibi TEK kapak görünür.
        // Tıklanınca yazarın TÜM kitaplarını (tamamlanmış + devam eden)
        // gösteren bir pencere açılır; oradan istenen kitaba girilir.
        const ilkKitap = grup.volumes[0];
        const guvenliAd = ilkKitap.name.replace(/"/g, '&quot;');
        const modalId = 'ym_' + ilkKitap.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const tamamlanan = grup.volumes.filter(v => v.volumeComplete).length;
        const ozetEtiket = tamamlanan === grup.volumes.length
            ? `${grup.volumes.length} Kitap`
            : `${tamamlanan} Kitap Tamamlandı`;

        authorCards += `
        <div class="author-card" onclick="yazarKitaplariniAc('${modalId}')" data-name="${guvenliAd}" data-count="${grup.toplamYazi}" data-modal="${modalId}">
            <div class="book-cover">
                <div class="book-spine"></div>
                <div class="cover-author-overlay">
                    <h3 class="cover-author-name">${ilkKitap.name}</h3>
                </div>
            </div>
            <div class="kitap-etiketi">${ozetEtiket}</div>
        </div>`;

        const icKartlar = grup.volumes.map(v => kartUret(v)).join('');
        yazarModallari += `
        <div class="yazar-modal" id="${modalId}">
            <div class="yazar-modal-arka" onclick="modalKapat('${modalId}')"></div>
            <div class="yazar-modal-icerik">
                <button class="yazar-modal-kapat" onclick="modalKapat('${modalId}')" aria-label="Kapat">✕</button>
                <h2 class="yazar-modal-baslik">${ilkKitap.name}</h2>
                <div class="yazar-modal-grid">${icKartlar}</div>
            </div>
        </div>`;
    });

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mektep Yazar Kütüphanesi</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Dancing+Script:wght@600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0b0e14;
            --text: #f5f6fa;
            --accent: #ffc107;
            --accent-glow: rgba(255, 193, 7, 0.4);
            --primary: #4f46e5;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: radial-gradient(circle at 50% 20%, #151a26 0%, #0a0c12 70%, #050608 100%);
            color: var(--text);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
        }
        header {
            text-align: center;
            padding: 50px 20px 40px;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.8), rgba(11, 14, 20, 0));
            border-bottom: 1px solid rgba(255,255,255,0.05);
            position: relative;
        }
        header h1 {
            margin: 0;
            font-family: 'Cinzel', serif;
            font-size: 2.6rem;
            font-weight: 700;
            letter-spacing: 4px;
            color: #fff;
            text-shadow: 0 0 20px rgba(255,193,7,0.3);
        }
        /* Logolar ve çıkış butonu 2026-08-06'da satır içi stilden buraya taşındı —
           satır içi stiller medya sorgusuyla ezilemediği için telefonda logolar
           başlığın ÜZERİNE biniyor, çıkış butonu kart yazılarını kapatıyordu. */
        .header-logo {
            position: absolute;
            top: 20px;
            height: 84px;
            width: auto;
            border-radius: 50%;
            box-shadow: 0 4px 18px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.9);
            background: #fff;
        }
        .header-logo-sol { left: 20px; }
        .header-logo-sag { right: 20px; }
        .cikis-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            margin-top: 0;
            padding: 8px 16px;
            font-size: 0.8rem;
            z-index: 50;
        }
        header .subtitle-cursive {
            font-family: 'Dancing Script', cursive;
            font-size: 1.8rem;
            color: var(--accent);
            margin-top: 4px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .header-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.06);
            color: var(--text);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 10px 22px;
            border-radius: 30px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 600;
            transition: all 0.3s ease;
            cursor: pointer;
            margin-top: 20px;
            backdrop-filter: blur(10px);
        }
        .header-btn:hover {
            background: var(--accent);
            color: #000;
            border-color: var(--accent);
            box-shadow: 0 0 20px var(--accent-glow);
        }
        
        .arac-cubugu {
            display: flex;
            gap: 14px;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            padding: 30px 20px 0;
        }
        .arac-cubugu input, .arac-cubugu select {
            background: rgba(22, 27, 38, 0.8);
            color: var(--text);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            padding: 12px 18px;
            font-size: 0.95rem;
            outline: none;
            backdrop-filter: blur(8px);
            transition: 0.2s;
        }
        .arac-cubugu input { width: min(340px, 75vw); }
        .arac-cubugu input:focus { border-color: var(--accent); box-shadow: 0 0 12px var(--accent-glow); }
        .sonuc-yok {
            text-align: center;
            color: #a4b0be;
            padding: 40px;
            display: none;
        }
        .library-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 45px 35px;
            padding: 50px 40px 80px;
            max-width: 1300px;
            margin: 0 auto;
        }
        .author-card {
            cursor: pointer;
            perspective: 1200px;
            position: relative;
            /* Kapak genişliği: "Yeni sekmede" düğmesi KARTIN değil KAPAĞIN sağ
               üst köşesine hizalanır (kart, ızgara gözü kadar geniş olduğu için
               düğme kapağın dışına taşardı). Kapak ölçüsü kırılma noktalarında
               değiştiği için değişkenle taşınıyor — .book-cover width'i
               değişirse bu da güncellenmeli. */
            --kapak-g: 200px;
        }
        /* "Yeni sekmede aç" — kapağın üzerine gelince beliren küçük düğme.
           .book-cover'ın İÇİNDE değil, kartın içinde konumlandırılır: kapak
           hover'da rotateY ile dönüyor ve overflow:hidden ile kırpıyor, düğme
           orada olsaydı onunla birlikte eğilip kenardan kesilirdi.
           Gerçek bir <a target="_blank"> olduğu için tarayıcının kendi
           "bağlantıyı yeni sekmede aç", orta tık ve Ctrl+tık davranışları da
           çalışır. */
        .yeni-sekme-btn {
            position: absolute;
            top: 8px;
            right: calc(50% - var(--kapak-g) / 2 + 8px);
            z-index: 20;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 6px 10px;
            font-size: 0.72rem;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
            color: #ffe9a8;
            text-decoration: none;
            white-space: nowrap;
            background: rgba(12, 20, 38, 0.88);
            border: 1px solid rgba(255, 193, 7, 0.55);
            border-radius: 999px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.55);
            opacity: 0;
            transform: translateY(-4px);
            pointer-events: none;
            transition: opacity 0.22s ease, transform 0.22s ease, background 0.2s ease;
        }
        .author-card:hover .yeni-sekme-btn,
        .yeni-sekme-btn:focus-visible {
            opacity: 1;
            transform: translateY(0);
            pointer-events: auto;
        }
        .yeni-sekme-btn:hover {
            background: rgba(255, 193, 7, 0.92);
            color: #1a1408;
            border-color: rgba(255, 193, 7, 0.9);
        }
        /* Dokunmatik cihazda hover yok — düğme kalıcı görünür, yoksa telefonda
           hiç erişilemezdi. Ama tam etiketiyle (114 px) 145 px'lik kapağın
           neredeyse tamamını örtüyordu; bu yüzden yazı gizlenip sadece ok
           simgesi kalıyor, küçük yuvarlak bir düğmeye dönüşüyor. */
        @media (hover: none) {
            .yeni-sekme-btn {
                opacity: 1;
                transform: none;
                pointer-events: auto;
                font-size: 0.8rem;
                padding: 0;
                width: 26px;
                height: 26px;
                justify-content: center;
            }
            .yeni-sekme-yazi { display: none; }
        }
        .author-card.yakinda { cursor: default; }
        .author-card.yakinda .book-cover {
            opacity: 0.45;
            filter: grayscale(0.7);
        }
        .author-card.yakinda:hover .book-cover {
            transform: none;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        /* Premium Modern Book Cover Design */
        .book-cover {
            position: relative;
            width: 200px;
            height: 310px;
            margin: 0 auto;
            border-radius: 4px 10px 10px 4px;
            transform-style: preserve-3d;
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease;
            box-shadow: -8px 12px 30px rgba(0, 0, 0, 0.7),
                        inset 2px 0 3px rgba(255, 255, 255, 0.15),
                        inset -1px 0 2px rgba(0, 0, 0, 0.4);
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background-image: url('kapak.png');
            background-size: cover;
            background-position: center;
        }
        /* 3D Spine Effect */
        .book-spine {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 14px;
            background: linear-gradient(to right, rgba(0,0,0,0.6), rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.4));
            z-index: 10;
            border-right: 1px solid rgba(255,255,255,0.1);
        }
        .author-card:hover .book-cover {
            transform: rotateY(-18deg) translateY(-8px) scale(1.03);
            box-shadow: -15px 20px 40px rgba(0, 0, 0, 0.8),
                        0 0 25px rgba(255, 193, 7, 0.25);
        }
        /* 2026-08-06 kalibrasyonu: kapak.png'deki (1131x1600) iki süsleme
           çizgisinin arası — üst çizgi %55.6, alt çizgi %64.66, yani bandın
           yüksekliği %9.07. Sabit bir "top" değeri yerine BANDIN KENDİSİ
           konumlandırılıp içerik flex ile dikey ortalanıyor; böylece yazar adı
           tek satır da olsa iki satıra sarsa da (uzun unvanlı isimler)
           boşluğun tam ortasında kalıyor, çizgilere yaslanmıyor. */
        .cover-author-overlay {
            position: absolute;
            top: 55.6%;
            height: 9.07%;
            left: 10px;
            right: 10px;
            z-index: 5;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .cover-author-name {
            font-family: 'Inter', sans-serif;
            font-size: 0.58rem;
            font-weight: 700;
            color: #1c3050;
            margin: 0;
            letter-spacing: 0.3px;
            line-height: 1.1;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .kitap-etiketi {
            text-align: center;
            margin-top: 10px;
            font-family: 'Inter', sans-serif;
            font-size: 0.78rem;
            font-weight: 700;
            color: var(--accent);
            letter-spacing: 0.5px;
        }
        .kitap-tik {
            color: #2ecc71;
            font-weight: 900;
        }
        .premium-badge {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1.5px solid var(--accent);
            border-radius: 8px;
            padding: 5px 12px;
            font-size: 0.72rem;
            font-weight: 700;
            color: #fff;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
            margin-top: 12px;
        }
        
        /* ── Telefon düzeni (2026-08-06'da elden geçirildi) ──
           Önceki hâlde sadece kart ızgarası küçültülüyordu; başlık, logolar ve
           çıkış butonu masaüstü ölçüleriyle kalıyordu. Sonuç: 375 px'lik ekranda
           "MEKTEP KÜTÜPHANESİ" başlığı kendi kutusundan 30 px taşıyor (sayfa
           385 px genişliyor → yatay kayma), iki logo başlığın üzerine biniyor,
           çıkış butonu alt sıradaki kartların yazılarını kapatıyordu. */
        @media (max-width: 600px) {
            .library-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 25px 15px;
                padding: 25px 15px;
            }
            .book-cover {
                width: 155px;
                height: 245px;
            }
            .author-card { --kapak-g: 155px; }
            /* Kart küçüldüğü için kapak üzerindeki yazı da oranlı küçülür
               (155/200 = 0.775) — aksi halde yazı kapağa göre şişkin kalıyor. */
            .cover-author-name { font-size: 0.45rem; }

            /* Kullanıcı isteği (2026-08-06): telefonda iki köşe logosu
               KALDIRILIYOR. 375px'lik ekranda iki adet 84px'lik logo,
               başlığa kalan genişliğin yarısını yiyor ve başlığın üzerine
               biniyordu. Masaüstünde simetrik yerleşim korunuyor. */
            .header-logo { display: none; }
            header { padding: 26px 14px 28px; }
            header h1 {
                font-size: 1.7rem;
                letter-spacing: 2px;
                line-height: 1.25;
                overflow-wrap: break-word;
            }
            header .subtitle-cursive { font-size: 1.2rem; }
            .cikis-btn {
                bottom: 12px;
                right: 12px;
                padding: 7px 12px;
                font-size: 0.72rem;
            }
        }

        /* Çok dar telefonlar (iPhone SE vb.) */
        @media (max-width: 380px) {
            header h1 { font-size: 1.45rem; letter-spacing: 1.5px; }
            .library-grid { gap: 20px 10px; padding: 20px 10px; }
            .book-cover { width: 145px; height: 229px; }
            .author-card { --kapak-g: 145px; }
        }

        /* ── Çok Kitaplı Yazar Penceresi ── */
        .yazar-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 300;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
        }
        .yazar-modal.acik { display: flex; }
        .yazar-modal-arka {
            position: absolute;
            inset: 0;
            background: rgba(5, 6, 10, 0.82);
            backdrop-filter: blur(4px);
        }
        .yazar-modal-icerik {
            position: relative;
            background: #12151f;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 18px;
            padding: 40px 30px 30px;
            max-width: 900px;
            width: 100%;
            max-height: 85vh;
            overflow-y: auto;
            box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }
        .yazar-modal-kapat {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 1px solid rgba(255,255,255,0.15);
            background: rgba(255,255,255,0.06);
            color: var(--text);
            font-size: 1rem;
            cursor: pointer;
        }
        .yazar-modal-kapat:hover { background: var(--accent); color: #000; }
        .yazar-modal-baslik {
            text-align: center;
            font-family: 'Cinzel', serif;
            font-size: 1.4rem;
            color: #fff;
            margin: 0 0 30px;
            letter-spacing: 1px;
        }
        .yazar-modal-grid {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 35px;
        }
    </style>
</head>
<body>
    <header>
        <!-- 2026-08-06: Sol/sağ üst köşedeki iki kırmızı daire ÖZKURBİR logosu
             kullanıcı isteğiyle KALDIRILDI (giriş sayfasında da kaldırılmıştı,
             artık iki sayfa tutarlı). Kurum kimliği kitap kapağında ve künye
             sayfasında zaten var. Geri istenirse:
             <img src="a-logo.png" alt="ÖZKURBİR" class="header-logo header-logo-sol">
             <img src="a-logo.png" alt="ÖZKURBİR" class="header-logo header-logo-sag"> -->
        <button onclick="cikisYap()" class="header-btn cikis-btn">🚪 Çıkış Yap</button>
        <h1>MEKTEP KÜTÜPHANESİ</h1>
        <div class="subtitle-cursive">Sonsuzluk İçinde Seçme Yazarlar</div>
        <div style="display:flex; justify-content:center; gap:12px; margin-top:10px;">
            <a href="mektep_yonetim.html" id="yonetim-butonu" class="header-btn">⚙️ Yönetici Paneli & İstatistikler</a>
        </div>
        <div id="hosgeldiniz-mesaj" style="margin-top: 15px; font-size: 0.9rem; color: #a4b0be; font-weight: 500;"></div>
    </header>

    <div class="arac-cubugu">
        <input id="ara" type="search" placeholder="🔍 Yazar ara..." oninput="suzVeSirala()">
        <select id="sirala" onchange="suzVeSirala()">
            <option value="yazi">Yazı sayısına göre</option>
            <option value="ad">Ada göre (A→Z)</option>
        </select>
    </div>
    <p class="sonuc-yok" id="sonuc-yok">Aramanla eşleşen yazar bulunamadı.</p>

    <div class="library-grid" id="izgara">
        ${authorCards}
    </div>

    ${yazarModallari}

    <footer style="text-align: center; padding: 50px 20px 30px; margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.07); color: #6b7280; font-size: 0.78rem; letter-spacing: 0.3px;">
        <div>© ${new Date().getFullYear()} ÖZKURBİR Mektep Kütüphanesi</div>
        <div style="margin-top: 6px; opacity: 0.75;">Powered By Mehmet Kutlu</div>
    </footer>

    <script>
        // Kullanıcı adı → gerçek yazar adı/kimlik eşlemesi (bkz. createLibraryHTML
        // yorumu). Sadece build-time'da bilinen GERÇEK veritabanı bilgisi —
        // login.html'in tahminine güvenilmiyor.
        const YAZAR_KIMLIKLERI = ${JSON.stringify(yazarKimlikleri)};

        // Oturum kontrolü
        const role = localStorage.getItem('userRole');
        if (!role) {
            window.location.href = 'login.html';
        }

        // Görünürlük ayarları
        if (role === 'admin') {
            document.getElementById('yonetim-butonu').style.display = 'inline-flex';
            document.getElementById('hosgeldiniz-mesaj').innerHTML = '👋 Hoş geldiniz, <strong>Yönetici</strong>';
        } else if (role === 'author') {
            document.getElementById('yonetim-butonu').style.display = 'none';

            // Giriş kullanıcı adına göre GERÇEK ad/kimliği eşlemeden çöz —
            // localStorage'daki authorRealName login.html'in (yanlış olabilecek)
            // tahminidir, buradaki eşleme gerçek veritabanı kaydına dayanır.
            const girisKullaniciAdi = (localStorage.getItem('username') || '').trim().toLocaleLowerCase('tr');
            const yazarKaydi = YAZAR_KIMLIKLERI[girisKullaniciAdi];
            const yazarIsim = (yazarKaydi && yazarKaydi.name) || localStorage.getItem('authorRealName') || '';
            const yazarId = (yazarKaydi && yazarKaydi.id) || (localStorage.getItem('authorId') || '').toUpperCase();
            if (yazarKaydi) {
                localStorage.setItem('authorRealName', yazarIsim);
                localStorage.setItem('authorId', yazarId);
            }
            document.getElementById('hosgeldiniz-mesaj').innerHTML = '✍️ Hoş geldiniz Yazar, <strong>' + yazarIsim + '</strong>';

            // YAZAR girişinde özet kart + popup YOK: yazar kendi sayfasına
            // girdiğinde bütün kitapları doğrudan rafta yan yana görmeli
            // (2026-08-05 isteği). Her özet kartın yerine, kendi modalindeki
            // cilt kartları sırayla ızgaraya taşınır; özet kart ve artık boşa
            // düşen modal DOM'dan silinir. Bu, aşağıdaki "sadece kendi kitabı"
            // süzgecinden ÖNCE çalışmalı — aksi halde başka bir yazarın özet
            // kartı silinip modali yetim kalır. Okuyucu ve yönetici girişinde
            // özet kart + popup davranışı aynen korunur.
            document.querySelectorAll('.author-card[data-modal]').forEach(ozetKart => {
                const modal = document.getElementById(ozetKart.dataset.modal);
                if (modal) {
                    modal.querySelectorAll('.author-card').forEach(ciltKarti => {
                        ozetKart.parentNode.insertBefore(ciltKarti, ozetKart);
                    });
                    modal.remove();
                }
                ozetKart.remove();
            });

            // Yazar SADECE kendi kitabını/kitaplarını görsün — başka yazarların
            // kartları DOM'dan tamamen kaldırılır (arama/sıralama ile geri
            // gelmesinler diye style.display değil .remove() kullanılıyor).
            const yazarAdUst = yazarIsim.trim().toLocaleUpperCase('tr');
            const yazarIdUst = yazarId.toUpperCase();
            let kalanKart = 0;
            document.querySelectorAll('.author-card').forEach(kart => {
                const kartAd = (kart.dataset.name || '').trim().toLocaleUpperCase('tr');
                const kartId = kartAd.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
                const kendiKitabiMi = (yazarAdUst && kartAd === yazarAdUst) || (yazarIdUst && kartId === yazarIdUst);
                if (!kendiKitabiMi) kart.remove(); else kalanKart++;
            });

            /* Yazar giriş yaptı ama hiçbir kart eşleşmedi → SESSİZ BOŞ RAF.
               Kullanıcının "yazarın yazıları görünmüyor" şikâyeti buydu.
               Artık sebebi ayırt edip açıkça söylüyoruz: (a) kullanıcı adı
               eşlemede yok (yanlış/eskimiş kullanıcı adıyla giriş yapılmış),
               (b) eşleme doğru ama yazarın hiç yazısı yok (kitap üretilmemiş). */
            if (kalanKart === 0) {
                const grid = document.querySelector('.library-grid');
                if (grid) {
                    const tanindi = !!yazarKaydi;
                    grid.innerHTML =
                        '<div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#e8e8f0;">'
                        + '<div style="font-size:2.4rem; margin-bottom:14px;">' + (tanindi ? '📭' : '⚠️') + '</div>'
                        + '<h3 style="margin:0 0 10px; color:#ffc107;">'
                        + (tanindi ? 'Henüz kitabınız oluşmamış' : 'Kullanıcı adı tanınmadı')
                        + '</h3>'
                        + '<p style="margin:0 auto; max-width:520px; line-height:1.6; color:#b9b9c8;">'
                        + (tanindi
                            ? ('<strong>' + yazarIsim + '</strong> adına kayıtlı yazı bulunmadığı için kitapçık üretilmemiş. '
                               + 'Yönetici, panelden "✍️ Elle Yazı Ekle" ile yazı girdiğinde kitabınız burada görünecek.')
                            : ('Girdiğiniz kullanıcı adı (<strong>' + (localStorage.getItem('username') || '') + '</strong>) '
                               + 'sistemdeki yazar kayıtlarıyla eşleşmedi, bu yüzden size ait bir kitap bulunamadı. '
                               + 'Doğru kullanıcı adınızı yöneticiden öğrenip tekrar giriş yapın.'))
                        + '</p></div>';
                }
            }
        } else {
            document.getElementById('yonetim-butonu').style.display = 'none';
            document.getElementById('hosgeldiniz-mesaj').innerHTML = '📖 <strong>Okuyucu Paneli</strong>';
        }

        function cikisYap() {
            localStorage.removeItem('userRole');
            localStorage.removeItem('username');
            localStorage.removeItem('password');
            localStorage.removeItem('authorRealName');
            localStorage.removeItem('authorId');
            window.location.href = 'login.html';
        }

        function openFlipbook(authorId, authorRealName) {
            localStorage.setItem('currentAuthor', authorId);
            if (authorRealName) {
                localStorage.setItem('currentAuthorRealName', authorRealName);
            }
            window.location.href = 'flipbook/index.html';
        }

        // Çok kitaplı yazarın ana raftaki tek kapağına tıklanınca açılan,
        // yazarın tüm kitaplarını (tamamlanmış + devam eden) gösteren pencere.
        function yazarKitaplariniAc(modalId) {
            document.getElementById(modalId)?.classList.add('acik');
        }
        function modalKapat(modalId) {
            document.getElementById(modalId)?.classList.remove('acik');
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.yazar-modal.acik').forEach(m => m.classList.remove('acik'));
            }
        });

        function suzVeSirala() {
            const sorgu = document.getElementById('ara').value.trim().toLocaleLowerCase('tr');
            const olcut = document.getElementById('sirala').value;
            const izgara = document.getElementById('izgara');
            const kartlar = [...izgara.querySelectorAll('.author-card')];

            kartlar.sort((a, b) => {
                const kitapFarki = b.classList.contains('yakinda') - a.classList.contains('yakinda');
                if (kitapFarki !== 0) return -kitapFarki;
                if (olcut === 'ad') return a.dataset.name.localeCompare(b.dataset.name, 'tr');
                return Number(b.dataset.count) - Number(a.dataset.count);
            }).forEach(k => izgara.appendChild(k));

            let gorunen = 0;
            kartlar.forEach(k => {
                const uyuyor = !sorgu || k.dataset.name.toLocaleLowerCase('tr').includes(sorgu);
                k.style.display = uyuyor ? '' : 'none';
                if (uyuyor) gorunen++;
            });
            document.getElementById('sonuc-yok').style.display = gorunen ? 'none' : 'block';
        }
    </script>
</body>
</html>`;
}

function createAdminHTML(authors) {
    const totalAuthors = authors.length;
    const totalArticles = authors.reduce((sum, a) => sum + (a.articles ? a.articles.length : 0), 0);
    const publishedBooks = authors.filter(a => a.articles && a.articles.length >= KITAP_ESIGI).length;
    const pendingAuthors = authors.filter(a => !a.articles || a.articles.length < KITAP_ESIGI).length;

    // "Elle Yazı Ekle" penceresindeki yazar listesi — alfabetik (Türkçe
    // sıralama), yanında mevcut yazı sayısı. Kopya alınmalı: aşağıdaki
    // tableRows `authors` dizisini YERİNDE sıralıyor (.sort), doğrudan
    // kullanılsaydı seçenekler de o sıralamadan etkilenirdi.
    const yazarSecenekleri = [...authors]
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'))
        .map(a => {
            const sayi = (a.articles && a.articles.length) || 0;
            const ad = (a.name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            return `<option value="${ad}" data-sayi="${sayi}">${ad} (${sayi} yazı)</option>`;
        }).join('');

    const topAuthors = [...authors]
        .sort((a, b) => (b.articles?.length || 0) - (a.articles?.length || 0))
        .slice(0, 10);

    const maxArticle = topAuthors[0]?.articles?.length || 1;

    let topAuthorRows = topAuthors.map((a, idx) => {
        const count = a.articles?.length || 0;
        const pct = Math.round((count / maxArticle) * 100);
        return '<div style="margin-bottom: 12px;">' +
            '<div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 4px;">' +
                '<span style="font-weight: 600; color: #f5f6fa;">' + (idx + 1) + '. ' + a.name + '</span>' +
                '<span style="color: #e1b12c; font-weight: 700;">' + count + ' Makale</span>' +
            '</div>' +
            '<div style="background: #2b2b36; height: 8px; border-radius: 4px; overflow: hidden;">' +
                '<div style="background: linear-gradient(90deg, #4f46e5, #e1b12c); height: 100%; width: ' + pct + '%;"></div>' +
            '</div>' +
        '</div>';
    }).join('');

    const tableRows = authors
        .sort((a, b) => (b.articles?.length || 0) - (a.articles?.length || 0))
        .map((a, idx) => {
            const count = a.articles?.length || 0;
            const pageCount = a.pageCount || 0;
            // Kitap sayısı yazı sayısına göre — sayfa sayısı yazıdan yazıya değişir.
            const bookCount = Math.floor(count / 40);
            const isBook = count >= KITAP_ESIGI;
            const safeName = a.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
            
            const flipBtn = isBook ? '<button class="tbl-btn" onclick="openFlipbook(\'' + safeName + '\', \'' + safeName + '\')">📖 Flipbook Oku</button>' : '';
            const pdfBtn = isBook ? '<a class="tbl-btn pdf-btn" href="pdf_ciktilari/' + safeName + '.pdf" target="_blank" download>📄 PDF İndir</a>' : '';
            const statusBadge = isBook 
                ? '<span style="background: rgba(46, 204, 113, 0.15); color: #2ecc71; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">🟢 Kitap Basıldı (' + count + ' Yazı)</span>'
                : '<span style="background: rgba(241, 196, 15, 0.15); color: #f1c40f; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem;">⏳ ' + (KITAP_ESIGI - count) + ' Yazı Kaldı</span>';

            const credentials = `<div style="font-size: 0.8rem; line-height: 1.4;">
                <span style="color:#aaa;">Kullanıcı:</span> <code id="usr-${safeName}">${a.username || ''}</code><br>
                <span style="color:#aaa;">Şifre:</span> <code id="pwd-${safeName}">${a.password || ''}</code> 
                <button class="tbl-btn" style="padding: 2px 6px; font-size: 0.7rem; margin-left: 4px; background: #374151;" onclick="bilgileriDuzenle('${a.name.replace(/'/g, "\\'")}', '${safeName}')">✍️ Düzenle</button>
            </div>`;

            let listBadge = '';
            if (count >= 120) listBadge = ' 💎';
            else if (count >= 80) listBadge = ' 🥇';
            else if (count >= 40) listBadge = ' 🥈';

            return '<tr data-name="' + a.name.replace(/"/g, '&quot;') + '" style="border-bottom: 1px solid #2d2d38;">' +
                '<td style="padding: 12px; color: #8a8a9e;">' + (idx + 1) + '</td>' +
                '<td style="padding: 12px; font-weight: 600; color: #fff;">' + a.name + listBadge + '</td>' +
                '<td style="padding: 12px; font-weight: 700; color: #e1b12c;">' + count + ' Yazı</td>' +
                '<td style="padding: 12px; font-weight: 700; color: #a4b0be;">' + pageCount + ' Sayfa</td>' +
                '<td style="padding: 12px; font-weight: 700; color: #38bdf8;">' + bookCount + ' Kitap</td>' +
                '<td style="padding: 12px;">' + credentials + '</td>' +
                '<td style="padding: 12px;">' + statusBadge + '</td>' +
                '<td style="padding: 12px;">' +
                    '<div style="display: flex; gap: 6px; flex-wrap: wrap;">' +
                        flipBtn + pdfBtn +
                        '<button class="tbl-btn info-btn" onclick="showArticleModal(\'' + safeName + '\')">👁️ Makaleler (' + count + ')</button>' +
                    '</div>' +
                '</td>' +
            '</tr>';
        }).join('');

    return `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mektep Yazar Yönetim & İstatistik Paneli</title>
    <style>
        :root {
            --bg: #18181c;
            --card-bg: #22222a;
            --text: #f5f6fa;
            --accent: #e1b12c;
            --primary: #4f46e5;
            --border: #2d2d38;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, sans-serif;
        }
        header {
            padding: 30px 40px;
            background: linear-gradient(135deg, #1f242e, #141418);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        header h1 {
            margin: 0;
            font-size: 1.8rem;
            color: var(--accent);
            font-weight: 600;
        }
        header p {
            margin: 4px 0 0 0;
            color: #9aa0a6;
            font-size: 0.95rem;
        }
        .header-actions {
            display: flex;
            gap: 12px;
        }
        .btn-act {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #2b2b36;
            color: #fff;
            border: 1px solid var(--border);
            padding: 10px 18px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-act:hover {
            background: var(--accent);
            color: #111;
            border-color: var(--accent);
        }
        .btn-act.sync-btn {
            background: var(--primary);
            border-color: var(--primary);
        }
        .btn-act.sync-btn:hover {
            background: #4338ca;
            color: #fff;
        }
        /* Elle yazı ekleme — taramadan (mor) ayrışsın diye yeşil. */
        .btn-act.ekle-btn {
            background: #15803d;
            border-color: #15803d;
        }
        .btn-act.ekle-btn:hover {
            background: #166534;
            color: #fff;
            border-color: #166534;
        }
        /* Yazı ekleme formu alanları */
        .form-satir { margin-bottom: 16px; }
        .form-satir label {
            display: block;
            margin-bottom: 6px;
            font-weight: 600;
            color: #e5e7eb;
            font-size: 0.9rem;
        }
        .form-satir select,
        .form-satir input[type="text"],
        .form-satir textarea {
            width: 100%;
            box-sizing: border-box;
            background: #18181c;
            color: #f3f4f6;
            border: 1px solid #3a3a46;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 0.95rem;
            font-family: inherit;
            outline: none;
        }
        .form-satir select:focus,
        .form-satir input[type="text"]:focus,
        .form-satir textarea:focus { border-color: var(--accent); }
        .form-satir textarea { min-height: 240px; line-height: 1.6; resize: vertical; }
        .form-ipucu { font-size: 0.82rem; color: #8a8a9e; margin-top: 6px; }

        .container {
            max-width: 1300px;
            margin: 30px auto;
            padding: 0 20px;
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .kpi-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .kpi-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #8a8a9e;
            margin-bottom: 8px;
        }
        .kpi-value {
            font-size: 2.2rem;
            font-weight: 800;
            color: #fff;
        }
        .kpi-sub {
            font-size: 0.8rem;
            color: #2ecc71;
            margin-top: 6px;
        }

        .section-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 26px;
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--accent);
            margin-top: 0;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }
        th {
            background: #1a1a20;
            padding: 12px;
            font-size: 0.85rem;
            color: #8a8a9e;
            text-transform: uppercase;
            border-bottom: 2px solid var(--border);
        }
        .tbl-btn {
            background: #2d2d38;
            color: #fff;
            border: 1px solid #444;
            padding: 5px 10px;
            border-radius: 6px;
            font-size: 0.78rem;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: 0.2s;
        }
        .tbl-btn:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        .tbl-btn.pdf-btn { background: #1e3a8a; border-color: #2563eb; }
        .tbl-btn.pdf-btn:hover { background: #2563eb; }
        .tbl-btn.info-btn { background: #374151; }

        .modal-bg {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            display: none;
            place-items: center;
            z-index: 100;
            padding: 20px;
        }
        .modal-card {
            background: #22222a;
            border: 1px solid var(--border);
            border-radius: 14px;
            width: min(750px, 95vw);
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .modal-head {
            padding: 18px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #1a1a20;
        }
        .modal-head h3 { margin: 0; font-size: 1.1rem; color: var(--accent); }
        .modal-close { background: none; border: none; color: #888; font-size: 1.4rem; cursor: pointer; }
        .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
        .art-item {
            padding: 12px;
            border-bottom: 1px solid #2d2d38;
        }
        .art-item:last-child { border-bottom: none; }
        .art-title { font-weight: 600; color: #fff; margin-bottom: 4px; }
        .art-date { font-size: 0.8rem; color: #8a8a9e; }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>📊 MEKTEP YAZAR YÖNETİM & İSTATİSTİK PANELİ</h1>
            <p>mektep.ozkurbir.org İnternet Sitesi Canlı Veri Analitik ve Kitapçık Otomasyon Portalı</p>
        </div>
        <div class="header-actions">
            <a href="mektep_kutuphane.html" class="btn-act">📚 Kütüphaneye Dön</a>
            <button class="btn-act" onclick="showChangePasswordModal()" style="background:#374151; border-color:#4b5563;">🔑 Şifre Değiştir</button>
            <button class="btn-act" onclick="showPendingArticlesModal()" style="background:#0284c7; border-color:#0284c7; position:relative;">
                📩 Onay Bekleyen Yazılar
                <span id="pending-badge" style="display:none; background:#ef4444; color:#fff; border-radius:10px; padding:2px 8px; font-size:0.75rem; font-weight:700; margin-left:4px;">0</span>
            </button>
            <button class="btn-act" id="btn-roller" onclick="showRolesModal()" style="background:#7c3aed; border-color:#7c3aed;">👥 Kullanıcı Yetkileri</button>
            <button class="btn-act ekle-btn" onclick="showAddArticleModal()">✍️ Elle Yazı Ekle</button>
            <button class="btn-act sync-btn" onclick="showSyncModal()">🔄 Webden Canlı Güncelle</button>
        </div>
    </header>

    <div class="container">
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-title">👥 Toplam Kayıtlı Yazar</div>
                <div class="kpi-value">${totalAuthors}</div>
                <div class="kpi-sub">Sitedeki aktif tüm yazarlar</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">📚 Basılan Kitap Sayısı</div>
                <div class="kpi-value" style="color: #2ecc71;">${publishedBooks}</div>
                <div class="kpi-sub">≥ ${KITAP_ESIGI} Yazısı olan e-kitapçıklar</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">📝 Toplam Makale Sayısı</div>
                <div class="kpi-value" style="color: var(--accent);">${totalArticles}</div>
                <div class="kpi-sub">Temizlenmiş özgün metin</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">⏳ Hazırlanan / Bekleyen Yazarlar</div>
                <div class="kpi-value" style="color: #f1c40f;">${pendingAuthors}</div>
                <div class="kpi-sub">< ${KITAP_ESIGI} Yazısı kalan yazarlar</div>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">
                <span>🏆 En Çok Yazı Yazan İlk 10 Yazar</span>
                <span style="font-size: 0.85rem; color: #8a8a9e;">İçerik Üretim Grafiği</span>
            </div>
            ${topAuthorRows}
        </div>

        <div class="section-card">
            <div class="section-title">
                <span>📋 Tüm Yazarlar ve Detaylı Durum Listesi</span>
                <input type="search" id="tbl-search" placeholder="🔍 Yazar tablosunda ara..." oninput="filterTable()" style="background: #18181c; color: #fff; border: 1px solid #3d3d47; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem;">
            </div>
            <div style="overflow-x: auto;">
                <table id="author-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Yazar Adı</th>
                            <th>Yazı Sayısı</th>
                            <th>Sayfa Sayısı</th>
                            <th>Kitap Sayısı (40 Sayfa)</th>
                            <th>Kullanıcı Bilgileri</th>
                            <th>Kitapçık Durumu</th>
                            <th>Eylemler / Bağlantılar</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="modal-bg" id="art-modal">
        <div class="modal-card">
            <div class="modal-head">
                <h3 id="art-modal-title">Yazar Makaleleri</h3>
                <button class="modal-close" onclick="closeArtModal()">&times;</button>
            </div>
            <div class="modal-body" id="art-modal-body"></div>
        </div>
    </div>

    <!-- Elle yazı ekleme (2026-08-06): site taraması bazen yeni yazıyı
         getirmiyor; yönetici o yazıyı buradan girip yazarın kitabının SONUNA
         ekleyebiliyor. İki yol da açık kalıyor — tarama + elle giriş. -->
    <div class="modal-bg" id="ekle-modal">
        <div class="modal-card">
            <div class="modal-head">
                <h3>✍️ Yazara Elle Yazı Ekle</h3>
                <button class="modal-close" onclick="closeAddArticleModal()">&times;</button>
            </div>
            <div class="modal-body" style="font-size: 0.95rem; color: #d1d5db;">
                <p style="margin-top:0; color:#a4b0be;">Yazı, seçtiğiniz yazarın listesinin <strong>sonuna</strong> eklenir ve kitapçıkları hemen yeniden üretilir. Sitede yayımlanmamış ya da taramanın getirmediği yazılar için kullanın.</p>

                <div class="form-satir">
                    <label for="ekle-yazar">Yazar</label>
                    <select id="ekle-yazar">
                        <option value="">— Yazar seçin —</option>
                        ${yazarSecenekleri}
                    </select>
                    <div class="form-ipucu" id="ekle-yazar-bilgi"></div>
                </div>

                <div class="form-satir">
                    <label for="ekle-baslik">Yazı Başlığı</label>
                    <input type="text" id="ekle-baslik" placeholder="Örn: BİR MEKTEBİN HATIRASI" autocomplete="off">
                    <div class="form-ipucu">Başlıklar kitapta büyük harfle basılır. Aynı yazarda <strong>aynı başlıktan ikinci bir kayıt açılmaz</strong>; varsa güncellemek isteyip istemediğiniz sorulur.</div>
                </div>

                <div class="form-satir">
                    <label for="ekle-icerik">Yazı Metni</label>
                    <textarea id="ekle-icerik" placeholder="Yazının tam metnini buraya yapıştırın.&#10;&#10;Paragrafları ayırmak için aralarına BOŞ BİR SATIR bırakın."></textarea>
                    <div class="form-ipucu">Paragraflar <strong>boş satırla</strong> ayrılır — tek satır sonu paragrafı bölmez.</div>
                </div>

                <div id="ekle-durum" style="display:none; margin-top:15px; padding:14px; border-radius:8px; border:1px solid #333; background:#18181c;">
                    <div id="ekle-durum-baslik" style="font-weight:700; margin-bottom:8px;"></div>
                    <div id="ekle-durum-mesaj" style="color:#a4b0be; font-size:0.9rem; white-space:pre-wrap;"></div>
                </div>

                <div style="text-align: right; margin-top: 20px;">
                    <button class="btn-act ekle-btn" id="ekle-kaydet-btn" onclick="yaziEkleGonder(false)">💾 Yazıyı Ekle ve Kitabı Yenile</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal-bg" id="sync-modal">
        <div class="modal-card">
            <div class="modal-head">
                <h3>🔄 Canlı İnternet Taraması ve Otomatik Güncelleme</h3>
                <button class="modal-close" onclick="closeSyncModal()">&times;</button>
            </div>
            <div class="modal-body" style="font-size: 0.95rem; line-height: 1.6; color: #d1d5db;">
                <p><strong>mektep.ozkurbir.org</strong> adresindeki tüm yeni makaleleri ve yeni yazarları otomatik olarak tarayıp sisteme işleme süreci:</p>
                <div style="background: #18181c; border: 1px solid #333; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <div style="color: #2ecc71; font-weight: 600; margin-bottom: 6px;">💡 Güncelleme Komut Satırı:</div>
                    <code style="color: #e1b12c; font-family: monospace;">node scrape.js && node build_library.js && node generate_pdf_kit.js</code>
                </div>
                <p>Bu komut çalıştırıldığında:</p>
                <ul style="padding-left: 20px; color: #a4b0be;">
                    <li>Sitedeki ${authors.length} yazarın tamamı kontrol edilir.</li>
                    <li>Yeni yayınlanan makaleler çekilerek veritabanına eklenir.</li>
                    <li>Akıllı Paragraf Temizlik Filtresi uygulanır.</li>
                    <li>PDF ve 3D Flipbook e-kitapçıkları anında yeniden üretilir.</li>
                </ul>
                <div id="sync-durum" style="display:none; margin-top:15px; padding:14px; border-radius:8px; border:1px solid #333; background:#18181c;">
                    <div id="sync-durum-baslik" style="font-weight:700; margin-bottom:8px;"></div>
                    <div id="sync-durum-mesaj" style="color:#a4b0be; font-size:0.9rem; white-space:pre-wrap;"></div>
                </div>
                <div style="text-align: right; margin-top: 20px;">
                    <button class="btn-act sync-btn" id="sync-baslat-btn" onclick="runClientSync()">🚀 Taramayı ve Güncellemeyi Başlat</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        /* Oturum kontrolü: yönetici VE denetim bu sayfaya girebilir.
           Denetim yalnızca onay bölümünü görür (aşağıda sadeleştirme var);
           gerçek yetki kontrolü her hâlükârda sunucuda yapılıyor. */
        const role = localStorage.getItem('userRole');
        if (role !== 'admin' && role !== 'denetim') {
            window.location.href = 'login.html';
        }

        const DB_AUTHORS = ${JSON.stringify(authors)};

        function filterTable() {
            const q = document.getElementById('tbl-search').value.trim().toLocaleLowerCase('tr');
            const rows = document.querySelectorAll('#author-table tbody tr');
            rows.forEach(r => {
                const name = r.dataset.name.toLocaleLowerCase('tr');
                r.style.display = (!q || name.includes(q)) ? '' : 'none';
            });
        }

        function openFlipbook(authorId, authorRealName) {
            localStorage.setItem('currentAuthor', authorId);
            if (authorRealName) {
                localStorage.setItem('currentAuthorRealName', authorRealName);
            }
            window.location.href = 'flipbook/index.html';
        }

        function showArticleModal(safeName) {
            const author = DB_AUTHORS.find(a => a.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() === safeName);
            if (!author || !author.articles) return;

            document.getElementById('art-modal-title').textContent = '✍️ ' + author.name + ' — Makale Listesi (' + author.articles.length + ' Yazı)';
            const body = document.getElementById('art-modal-body');
            
            body.innerHTML = author.articles.map((art, idx) => {
                return '<div class="art-item">' +
                    '<div class="art-title">' + (idx + 1) + '. ' + art.title + '</div>' +
                    '<div class="art-date">📅 ' + (art.date || 'Tarih Belirtilmemiş') + ' · <a href="' + art.url + '" target="_blank" style="color: var(--accent); text-decoration: none;">🌐 Orijinal Bağlantı</a></div>' +
                '</div>';
            }).join('');

            document.getElementById('art-modal').style.display = 'grid';
        }

        function closeArtModal() {
            document.getElementById('art-modal').style.display = 'none';
        }

        function showSyncModal() {
            document.getElementById('sync-modal').style.display = 'grid';
        }
        function closeSyncModal() {
            if (taramaSuruyor) {
                alert('Tarama hâlâ sürüyor. Lütfen tamamlanmasını bekleyin — pencereyi kapatmak işlemi durdurmaz ama sonucu göremezsiniz.');
                return;
            }
            document.getElementById('sync-modal').style.display = 'none';
        }

        /* ── Elle yazı ekleme (2026-08-06) ──────────────────────────────── */
        let yaziEklemeSuruyor = false;

        function showAddArticleModal() {
            document.getElementById('ekle-modal').style.display = 'grid';
            document.getElementById('ekle-yazar').focus();
        }
        function closeAddArticleModal() {
            if (yaziEklemeSuruyor) {
                alert('Yazı işleniyor ve kitapçıklar yeniden üretiliyor. Lütfen tamamlanmasını bekleyin.');
                return;
            }
            document.getElementById('ekle-modal').style.display = 'none';
        }

        function ekleDurumGoster(renk, baslik, mesaj) {
            const kutu = document.getElementById('ekle-durum');
            kutu.style.display = 'block';
            kutu.style.borderColor = renk;
            const b = document.getElementById('ekle-durum-baslik');
            b.style.color = renk;
            b.textContent = baslik;
            document.getElementById('ekle-durum-mesaj').textContent = mesaj;
        }

        // Yazar seçilince o yazarın mevcut yazı sayısını ve son yazısını göster
        // — yöneticinin doğru kişiyi seçtiğini teyit etmesi için.
        document.addEventListener('DOMContentLoaded', function () {
            const sec = document.getElementById('ekle-yazar');
            if (!sec) return;
            sec.addEventListener('change', function () {
                const bilgi = document.getElementById('ekle-yazar-bilgi');
                const yazar = DB_AUTHORS.find(a => a.name === sec.value);
                if (!yazar) { bilgi.textContent = ''; return; }
                const say = (yazar.articles && yazar.articles.length) || 0;
                const son = say ? yazar.articles[say - 1].title : '—';
                bilgi.textContent = 'Şu an ' + say + ' yazısı var. Son yazı: ' + son + ' · Yeni yazı bunun ardına eklenecek.';
            });
        });

        async function yaziEkleGonder(uzerineYaz) {
            if (yaziEklemeSuruyor) return;

            const yazar = document.getElementById('ekle-yazar').value.trim();
            const baslik = document.getElementById('ekle-baslik').value.trim();
            const icerik = document.getElementById('ekle-icerik').value.trim();

            if (!yazar) { ekleDurumGoster('#e74c3c', '✗ Yazar seçilmedi', 'Listeden bir yazar seçin.'); return; }
            if (!baslik) { ekleDurumGoster('#e74c3c', '✗ Başlık boş', 'Yazının başlığını girin.'); return; }
            if (!icerik) { ekleDurumGoster('#e74c3c', '✗ Metin boş', 'Yazının metnini girin.'); return; }

            const btn = document.getElementById('ekle-kaydet-btn');
            yaziEklemeSuruyor = true;
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.textContent = '⏳ İşleniyor...';

            const baslangic = Date.now();
            const sayac = setInterval(function () {
                const gecen = Math.round((Date.now() - baslangic) / 1000);
                ekleDurumGoster('#e1b12c', '⏳ İşleniyor (' + gecen + ' sn)',
                    'Yazı veritabanına kaydedildi; PDF ve flipbook kitapçıkları yeniden üretiliyor.\\nLütfen bu sayfayı kapatmayın.');
            }, 1000);

            function bitir() {
                clearInterval(sayac);
                yaziEklemeSuruyor = false;
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
                btn.textContent = '💾 Yazıyı Ekle ve Kitabı Yenile';
            }

            ekleDurumGoster('#e1b12c', '⏳ Gönderiliyor', 'Sunucuya bağlanılıyor...');

            let res;
            try {
                res = await fetch('/api/add-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: localStorage.getItem('userRole'),
                        username: localStorage.getItem('username'),
                        password: localStorage.getItem('password'),
                        authorName: yazar,
                        title: baslik,
                        content: icerik,
                        uzerineYaz: !!uzerineYaz
                    })
                });
            } catch (e) {
                bitir();
                if (location.protocol === 'file:') {
                    ekleDurumGoster('#e74c3c', '✗ Sayfa dosyadan açılmış',
                        'Bu sayfayı çift tıklayarak açtınız (dosya:// adresi); tarayıcı sunucuya istek atamaz.\\n\\nÇÖZÜM: Mac_Baslat.command dosyasına çift tıklayın, sonra şu adresi kullanın:\\nhttp://localhost:3000/login.html');
                } else {
                    ekleDurumGoster('#e74c3c', '✗ Sunucuya ulaşılamadı',
                        'Elle yazı ekleme yalnızca "node server.js" ile açılan sunucuda (http://localhost:3000) çalışır. Şu an açık olan adres: ' + location.origin);
                }
                return;
            }

            let data = null;
            try { data = await res.json(); } catch (e) {
                bitir();
                ekleDurumGoster('#e74c3c', '✗ Geçersiz sunucu yanıtı', 'Sunucu beklenen yanıtı vermedi (HTTP ' + res.status + ').');
                return;
            }

            bitir();

            // Aynı başlık zaten varsa sunucu 409 döner; ikinci bir kayıt AÇMAZ.
            // Yönetici onaylarsa istek uzerineYaz bayrağıyla tekrarlanır ve
            // mevcut kayıt güncellenir.
            if (res.status === 409 && data.yinelenen) {
                ekleDurumGoster('#e1b12c', '⚠ Bu başlık zaten var', data.error);
                if (confirm(data.error + '\\n\\nMevcut yazının METNİ bu girdiğinizle güncellensin mi?')) {
                    yaziEkleGonder(true);
                }
                return;
            }

            if (!res.ok || !data.success) {
                ekleDurumGoster('#e74c3c', '✗ İşlem başarısız',
                    (data.error || 'Bilinmeyen hata') + (data.detay ? '\\n\\nDetay:\\n' + data.detay : ''));
                return;
            }

            let ozet = 'Yazar: ' + data.yazar + '\\n' +
                'Başlık: ' + data.baslik + '\\n' +
                'Yazarın toplam yazı sayısı: ' + data.yaziSayisi + '\\n' +
                'Süre: ' + data.saniye + ' saniye';
            if (data.temizlenenYinelenen && data.temizlenenYinelenen.length) {
                ozet += '\\n\\nAynı başlıktan fazladan kayıt temizlendi: ' + data.temizlenenYinelenen.join(', ');
            }
            ozet += '\\n\\nSayfa 3 saniye içinde yenilenecek.';

            ekleDurumGoster('#2ecc71',
                data.islem === 'guncellendi' ? '✓ Mevcut yazı güncellendi' : '✓ Yazı eklendi ve kitap yenilendi',
                ozet);

            document.getElementById('ekle-baslik').value = '';
            document.getElementById('ekle-icerik').value = '';
            setTimeout(function () { location.reload(); }, 3000);
        }

        let taramaSuruyor = false;

        function syncDurumGoster(renk, baslik, mesaj) {
            const kutu = document.getElementById('sync-durum');
            kutu.style.display = 'block';
            kutu.style.borderColor = renk;
            const b = document.getElementById('sync-durum-baslik');
            b.style.color = renk;
            b.textContent = baslik;
            document.getElementById('sync-durum-mesaj').textContent = mesaj;
        }

        async function runClientSync() {
            if (taramaSuruyor) return;

            if (!confirm('mektep.ozkurbir.org taranacak ve tüm kitapçıklar yeniden üretilecek.\\n\\nBu işlem birkaç dakika sürebilir. Başlatılsın mı?')) return;

            const btn = document.getElementById('sync-baslat-btn');
            taramaSuruyor = true;
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.textContent = '⏳ Tarama sürüyor...';

            const baslangic = Date.now();
            const sayac = setInterval(function () {
                const gecen = Math.round((Date.now() - baslangic) / 1000);
                syncDurumGoster('#e1b12c', '⏳ Tarama sürüyor (' + gecen + ' sn)',
                    'Site taranıyor, veritabanı güncelleniyor ve PDF/flipbook kitapçıkları yeniden üretiliyor.\\nLütfen bu sayfayı kapatmayın.');
            }, 1000);

            syncDurumGoster('#e1b12c', '⏳ Tarama başlatıldı', 'Sunucuya bağlanılıyor...');

            function bitir() {
                clearInterval(sayac);
                taramaSuruyor = false;
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
                btn.textContent = '🚀 Taramayı ve Güncellemeyi Başlat';
            }

            let res;
            try {
                res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: localStorage.getItem('userRole'),
                        username: localStorage.getItem('username'),
                        password: localStorage.getItem('password')
                    })
                });
            } catch (e) {
                bitir();
                if (location.protocol === 'file:') {
                    syncDurumGoster('#e74c3c', '✗ Sayfa dosyadan açılmış',
                        'Bu sayfayı Finder/Gezgin üzerinden çift tıklayarak açtınız (dosya:// adresi). Bu şekilde açıldığında tarayıcı sunucuya istek atamaz.\\n\\nÇÖZÜM: Terminalde "node server.js" çalıştırın, sonra tarayıcıda şu adresi açıp yönetici olarak giriş yapın:\\nhttp://localhost:3000/login.html');
                } else {
                    syncDurumGoster('#e74c3c', '✗ Sunucuya ulaşılamadı',
                        'Bu özellik yalnızca "node server.js" ile açılan sunucuda (http://localhost:3000) çalışır. Şu an açık olan adres: ' + location.origin + '\\n\\nElle güncellemek için terminalde şu komutu çalıştırın:\\nnode scrape.js && node build_library.js && node generate_pdf_kit.js');
                }
                return;
            }

            let data = null;
            try {
                data = await res.json();
            } catch (e) {
                bitir();
                syncDurumGoster('#e74c3c', '✗ Geçersiz sunucu yanıtı',
                    'Sunucu beklenen yanıtı vermedi (HTTP ' + res.status + '). Sayfa büyük ihtimalle statik bir dosya sunucusu üzerinden açılmış; bu özellik için "node server.js" gereklidir.');
                return;
            }

            bitir();

            if (!res.ok || !data.success) {
                syncDurumGoster('#e74c3c', '✗ Güncelleme başarısız',
                    (data.error || 'Bilinmeyen hata') + (data.detay ? '\\n\\nDetay:\\n' + data.detay : ''));
                return;
            }

            const yeniYazar = data.yeniYazar || 0;
            const yeniMakale = data.yeniMakale || 0;
            let ozet = 'Süre: ' + data.saniye + ' saniye\\n' +
                'Yazar sayısı: ' + data.oncesi.yazar + ' → ' + data.sonrasi.yazar +
                (yeniYazar > 0 ? '  (+' + yeniYazar + ' yeni yazar)' : '') + '\\n' +
                'Makale sayısı: ' + data.oncesi.makale + ' → ' + data.sonrasi.makale +
                (yeniMakale > 0 ? '  (+' + yeniMakale + ' yeni makale)' : '');

            if (yeniYazar === 0 && yeniMakale === 0) {
                ozet += '\\n\\nYeni içerik bulunamadı — kütüphane zaten güncelmiş. Kitapçıklar yine de yeniden üretildi.';
                syncDurumGoster('#2ecc71', '✓ Güncelleme tamamlandı (yeni içerik yok)', ozet);
            } else {
                ozet += '\\n\\nSayfa 3 saniye içinde yenilenerek güncel veriler gösterilecek.';
                syncDurumGoster('#2ecc71', '✓ Güncelleme tamamlandı', ozet);
                setTimeout(function () { window.location.reload(); }, 3000);
            }
        }
        async function bilgileriDuzenle(authorRealName, safeName) {
            const currentUsr = document.getElementById('usr-' + safeName).textContent;
            const currentPwd = document.getElementById('pwd-' + safeName).textContent;
            
            const newUsr = prompt('"' + authorRealName + '" için yeni kullanıcı adı belirleyin:', currentUsr);
            if (newUsr === null) return; // cancelled
            
            const trimmedUsr = newUsr.trim().toLowerCase();
            if (!trimmedUsr) {
                alert('Kullanıcı adı boş olamaz!');
                return;
            }

            const newPwd = prompt('"' + authorRealName + '" için yeni şifre belirleyin:', currentPwd);
            if (newPwd === null) return; // cancelled
            
            const trimmedPwd = newPwd.trim();
            if (!trimmedPwd) {
                alert('Şifre boş olamaz!');
                return;
            }

            try {
                const res = await fetch('/api/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: localStorage.getItem('userRole'),
                        username: localStorage.getItem('username'),
                        password: localStorage.getItem('password'),
                        targetAuthorName: authorRealName,
                        newUsername: trimmedUsr,
                        newPassword: trimmedPwd
                    })
                });

                const data = await res.json();
                if (data.success) {
                    document.getElementById('usr-' + safeName).textContent = trimmedUsr;
                    document.getElementById('pwd-' + safeName).textContent = trimmedPwd;
                    alert('Bilgiler başarıyla güncellendi! Kütüphane dosyaları yeniden derlendi.');
                } else {
                    alert('Hata: ' + (data.error || 'Bilgiler güncellenemedi!'));
                }
            } catch (e) {
                console.error(e);
                alert('Sunucuyla bağlantı kurulamadı.');
            }
        }

        function showChangePasswordModal() {
            document.getElementById('change-pwd-modal').style.display = 'flex';
            document.getElementById('adm-cur-user').value = localStorage.getItem('username') || '';
            document.getElementById('adm-new-user').value = localStorage.getItem('username') || '';
            document.getElementById('adm-cur-pwd').value = '';
            document.getElementById('adm-new-pwd').value = '';
            document.getElementById('adm-new-pwd-confirm').value = '';
            document.getElementById('adm-pwd-durum').style.display = 'none';
        }

        function closeChangePasswordModal() {
            document.getElementById('change-pwd-modal').style.display = 'none';
        }

        async function submitAdminPasswordChange() {
            const curUser = document.getElementById('adm-cur-user').value.trim();
            const newUser = document.getElementById('adm-new-user').value.trim();
            const curPwd = document.getElementById('adm-cur-pwd').value.trim();
            const newPwd = document.getElementById('adm-new-pwd').value.trim();
            const newPwdConfirm = document.getElementById('adm-new-pwd-confirm').value.trim();
            const box = document.getElementById('adm-pwd-durum');

            if (!curUser || !curPwd) {
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.color = '#fca5a5';
                box.style.border = '1px solid #ef4444';
                box.textContent = '❌ Lütfen mevcut kullanıcı adı ve şifrenizi girin.';
                box.style.display = 'block';
                return;
            }

            if (!newUser || !newPwd) {
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.color = '#fca5a5';
                box.style.border = '1px solid #ef4444';
                box.textContent = '❌ Lütfen yeni kullanıcı adı ve yeni şifreyi boş bırakmayın.';
                box.style.display = 'block';
                return;
            }

            if (newPwd !== newPwdConfirm) {
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.color = '#fca5a5';
                box.style.border = '1px solid #ef4444';
                box.textContent = '❌ Yeni şifreler eşleşmiyor!';
                box.style.display = 'block';
                return;
            }

            box.style.background = 'rgba(59,130,246,0.15)';
            box.style.color = '#93c5fd';
            box.style.border = '1px solid #3b82f6';
            box.textContent = '⏳ Şifreniz güncelleniyor, lütfen bekleyin...';
            box.style.display = 'block';

            try {
                const res = await fetch('/api/change-admin-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentUsername: curUser,
                        currentPassword: curPwd,
                        newUsername: newUser,
                        newPassword: newPwd
                    })
                });

                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('username', newUser);
                    localStorage.setItem('password', newPwd);
                    box.style.background = 'rgba(34,197,94,0.15)';
                    box.style.color = '#86efac';
                    box.style.border = '1px solid #22c55e';
                    box.textContent = '✅ ' + data.message;
                    setTimeout(() => {
                        closeChangePasswordModal();
                    }, 1800);
                } else {
                    box.style.background = 'rgba(239,68,68,0.15)';
                    box.style.color = '#fca5a5';
                    box.style.border = '1px solid #ef4444';
                    box.textContent = '❌ ' + (data.message || 'Güncelleme başarısız.');
                }
            } catch (e) {
                console.error(e);
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.color = '#fca5a5';
                box.style.border = '1px solid #ef4444';
                box.textContent = '❌ Sunucuyla iletişim hatası oluştu.';
            }
        }

        async function loadPendingCount() {
            try {
                const u = localStorage.getItem('username') || '';
                const p = localStorage.getItem('password') || '';
                const res = await fetch(\`/api/pending-articles?username=\${encodeURIComponent(u)}&password=\${encodeURIComponent(p)}\`);
                const data = await res.json();
                if (data.success && data.pendingArticles) {
                    /* SADECE işlem bekleyenler sayılır. Onaylanan/reddedilen
                       kayıtlar artık listede kaldığı (geçmiş için) bu filtre
                       olmazsa rozet, işi bitmiş yazıları da sayıp hiç iş yokken
                       bile kırmızı bildirim gösterirdi. */
                    const count = data.pendingArticles.filter(x => (x.status || 'pending') === 'pending').length;
                    const badge = document.getElementById('pending-badge');
                    if (badge) {
                        if (count > 0) {
                            badge.textContent = count;
                            badge.style.display = 'inline-block';
                        } else {
                            badge.style.display = 'none';
                        }
                    }
                }
            } catch (e) {}
        }

        async function showPendingArticlesModal() {
            document.getElementById('pending-articles-modal').style.display = 'flex';
            document.getElementById('pending-durum-box').style.display = 'none';
            await fetchAndRenderPendingArticles();
        }

        function closePendingArticlesModal() {
            document.getElementById('pending-articles-modal').style.display = 'none';
        }

        /* ── KULLANICI YETKİLERİ (ROLLER) ─────────────────────────────────
           Roller sunucuda yazar kaydının rol alanında tutulur ve YETKİ
           KARARLARI SUNUCUDA verilir. Buradaki arayüz yalnızca atama yapar;
           tarayıcıdaki hiçbir şey yetkinin kendisi değildir. */
        window.ROL_CACHE = [];

        async function showRolesModal() {
            document.getElementById('roles-modal').style.display = 'flex';
            document.getElementById('roles-durum-box').style.display = 'none';
            await rolleriYukle();
        }

        function closeRolesModal() {
            document.getElementById('roles-modal').style.display = 'none';
        }

        async function rolleriYukle() {
            const kap = document.getElementById('roles-container');
            kap.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">Yükleniyor...</div>';
            try {
                const u = localStorage.getItem('username') || '';
                const p = localStorage.getItem('password') || '';
                const res = await fetch(\`/api/roles?username=\${encodeURIComponent(u)}&password=\${encodeURIComponent(p)}\`);
                const data = await res.json();
                if (!data.success) {
                    kap.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">' + (data.message || 'Yüklenemedi.') + '</div>';
                    return;
                }
                window.ROL_CACHE = data.roller;
                rolleriCiz(data.roller);
            } catch (e) {
                kap.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">Sunucu hatası.</div>';
            }
        }

        function rolEtiketi(r) {
            const m = {
                yonetici: { ad: 'Yönetici', renk: '#a78bfa' },
                denetim:  { ad: 'Denetim',  renk: '#38bdf8' },
                yazar:    { ad: 'Yazar',    renk: '#9ca3af' },
                okuyucu:  { ad: 'Okuyucu',  renk: '#f59e0b' }
            };
            return m[r] || m.yazar;
        }

        function rolleriCiz(liste) {
            const kap = document.getElementById('roles-container');
            if (!liste.length) {
                kap.innerHTML = '<div style="color:#9ca3af; text-align:center; padding:20px;">Kayıt yok.</div>';
                return;
            }
            kap.innerHTML = liste.map(k => {
                const et = rolEtiketi(k.rol);
                const secenekler = ['yonetici', 'denetim', 'yazar', 'okuyucu']
                    .map(r => \`<option value="\${r}" \${r === k.rol ? 'selected' : ''}>\${rolEtiketi(r).ad}</option>\`).join('');
                return \`
                <div style="display:flex; align-items:center; gap:12px; background:#18181c; border:1px solid #2d2d38; border-left:3px solid \${et.renk}; border-radius:8px; padding:10px 13px; margin-bottom:7px;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.9rem; font-weight:600; color:#e5e7eb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">\${k.name}</div>
                        <div style="font-size:0.73rem; color:#8a8a9e; margin-top:2px;">\${k.username || '—'} &nbsp;•&nbsp; \${k.yaziSayisi} yazı</div>
                    </div>
                    <select onchange="rolDegistir('\${k.name.replace(/'/g, "\\\\'")}', this.value, this)"
                            style="background:#22222a; color:#e5e7eb; border:1px solid #3a3a46; border-radius:6px; padding:6px 9px; font-size:0.82rem; cursor:pointer;">
                        \${secenekler}
                    </select>
                </div>\`;
            }).join('');
        }

        function rolleriFiltrele() {
            const q = (document.getElementById('roles-arama').value || '').toLocaleLowerCase('tr').trim();
            if (!q) return rolleriCiz(window.ROL_CACHE);
            rolleriCiz(window.ROL_CACHE.filter(k =>
                k.name.toLocaleLowerCase('tr').includes(q) ||
                (k.username || '').toLocaleLowerCase('tr').includes(q)
            ));
        }

        async function rolDegistir(hedefAd, yeniRol, selectEl) {
            const kutu = document.getElementById('roles-durum-box');
            const eskiRol = (window.ROL_CACHE.find(k => k.name === hedefAd) || {}).rol;

            if (yeniRol === 'yonetici' && !confirm(hedefAd + ' kullanıcısına TAM YÖNETİCİ yetkisi veriliyor.\\n\\nBu kişi rol atama dâhil her şeyi yapabilecek. Emin misiniz?')) {
                if (selectEl && eskiRol) selectEl.value = eskiRol;
                return;
            }

            try {
                const u = localStorage.getItem('username') || '';
                const p = localStorage.getItem('password') || '';
                const res = await fetch('/api/set-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p, hedefAd: hedefAd, rol: yeniRol })
                });
                const data = await res.json();

                kutu.style.display = 'block';
                if (data.success) {
                    kutu.style.background = 'rgba(34,197,94,0.15)';
                    kutu.style.color = '#86efac';
                    kutu.style.border = '1px solid #22c55e';
                    kutu.textContent = '✅ ' + data.message;
                    const k = window.ROL_CACHE.find(x => x.name === hedefAd);
                    if (k) k.rol = yeniRol;
                } else {
                    kutu.style.background = 'rgba(239,68,68,0.15)';
                    kutu.style.color = '#fca5a5';
                    kutu.style.border = '1px solid #ef4444';
                    kutu.textContent = '❌ ' + (data.message || 'Değiştirilemedi.');
                    if (selectEl && eskiRol) selectEl.value = eskiRol; // sunucu reddettiyse geri al
                }
            } catch (e) {
                kutu.style.display = 'block';
                kutu.style.background = 'rgba(239,68,68,0.15)';
                kutu.style.color = '#fca5a5';
                kutu.style.border = '1px solid #ef4444';
                kutu.textContent = '❌ Sunucu ile iletişim hatası.';
                if (selectEl && eskiRol) selectEl.value = eskiRol;
            }
        }

        async function fetchAndRenderPendingArticles() {
            const container = document.getElementById('pending-articles-container');
            container.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">Yükleniyor...</div>';
            
            try {
                const u = localStorage.getItem('username') || '';
                const p = localStorage.getItem('password') || '';
                const res = await fetch(\`/api/pending-articles?username=\${encodeURIComponent(u)}&password=\${encodeURIComponent(p)}\`);
                const data = await res.json();

                if (data.success && data.pendingArticles) {
                    const list = data.pendingArticles;
                    window.PENDING_ITEMS_CACHE = list;

                    /* Kayıtlar artık karar sonrası SİLİNMİYOR; durumlarına göre
                       ikiye ayrılıyor: üstte işlem bekleyenler, altta "kim neyi
                       ne zaman onayladı/reddetti" geçmişi. */
                    const bekleyenler = list.filter(x => (x.status || 'pending') === 'pending');
                    const gecmis = list
                        .filter(x => x.status === 'approved' || x.status === 'rejected')
                        .sort((a, b) => new Date(b.kararTarihi || 0) - new Date(a.kararTarihi || 0));

                    // Rozet YALNIZCA işlem bekleyenleri sayar.
                    const badge = document.getElementById('pending-badge');
                    if (badge) {
                        if (bekleyenler.length > 0) {
                            badge.textContent = bekleyenler.length;
                            badge.style.display = 'inline-block';
                        } else {
                            badge.style.display = 'none';
                        }
                    }

                    const bekleyenHtml = bekleyenler.length === 0
                        ? \`<div style="text-align:center; padding:32px 20px; background:#18181c; border-radius:10px; border:1px solid #2d2d38; color:#9ca3af;">
                               <div style="font-size:2rem; margin-bottom:8px;">✅</div>
                               <div>Şu anda onay bekleyen yeni bir yazar yazısı bulunmuyor.</div>
                           </div>\`
                        : bekleyenler.map(item => \`
                        <div style="background:#18181c; border:1px solid #2d2d38; border-radius:10px; padding:16px; display:flex; flex-direction:column; gap:10px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                <div>
                                    <span style="font-size:0.8rem; background:#3b82f6; color:#fff; padding:2px 8px; border-radius:4px; font-weight:600;">✍️ \${item.authorName}</span>
                                    <span style="font-size:0.78rem; color:#8a8a9e; margin-left:8px;">📅 \${new Date(item.submittedAt).toLocaleString('tr-TR')}</span>
                                    \${(item.revizyon || 1) > 1 ? \`<span style="font-size:0.72rem; background:#f59e0b; color:#111; padding:2px 7px; border-radius:4px; font-weight:700; margin-left:6px;">🔁 \${item.revizyon}. gönderim</span>\` : ''}
                                </div>
                            </div>
                            <div style="font-size:1.05rem; font-weight:700; color:#f3f4f6;">\${item.title}</div>
                            <div style="font-size:0.85rem; color:#9ca3af; line-height:1.5; max-height:60px; overflow:hidden; text-overflow:ellipsis;">
                                \${item.content.substring(0, 180)}...
                            </div>
                            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:6px; border-top:1px solid #282832; padding-top:10px;">
                                <button onclick="previewPendingArticle('\${item.id}')" class="tbl-btn" style="background:#4b5563;">👁️ İçeriği İncele</button>
                                <button onclick="processPendingArticle('\${item.id}', 'reject')" class="tbl-btn" style="background:#ef4444; border-color:#ef4444;">❌ Reddet</button>
                                <button onclick="processPendingArticle('\${item.id}', 'approve')" class="tbl-btn" style="background:#10b981; border-color:#10b981; font-weight:700;">✅ Onayla ve Yayınla</button>
                            </div>
                        </div>
                    \`).join('');

                    const gecmisHtml = gecmis.length === 0 ? '' : \`
                        <div style="margin-top:22px; border-top:1px solid #2d2d38; padding-top:16px;">
                            <div style="font-size:0.92rem; font-weight:700; color:#e5e7eb; margin-bottom:10px;">
                                🗂️ İşlem Geçmişi <span style="color:#8a8a9e; font-weight:500;">(\${gecmis.length} kayıt)</span>
                            </div>
                            \${gecmis.map(item => {
                                const onayli = item.status === 'approved';
                                const renk = onayli ? '#10b981' : '#ef4444';
                                const etiket = onayli ? '✅ Onaylandı' : '❌ Reddedildi';
                                return \`
                                <div style="background:#141418; border:1px solid #26262f; border-left:3px solid \${renk}; border-radius:8px; padding:11px 14px; margin-bottom:8px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                                        <div style="font-size:0.92rem; font-weight:600; color:#e5e7eb;">\${item.title}</div>
                                        <span style="font-size:0.75rem; color:\${renk}; font-weight:700;">\${etiket}</span>
                                    </div>
                                    <div style="font-size:0.76rem; color:#8a8a9e; margin-top:5px;">
                                        ✍️ \${item.authorName}
                                        &nbsp;•&nbsp; 👤 \${item.kararVeren || '—'}
                                        &nbsp;•&nbsp; 📅 \${item.kararTarihi ? new Date(item.kararTarihi).toLocaleString('tr-TR') : '—'}
                                    </div>
                                    \${item.redSebebi ? \`<div style="font-size:0.78rem; color:#fca5a5; margin-top:6px;">Gerekçe: \${item.redSebebi}</div>\` : ''}
                                </div>\`;
                            }).join('')}
                        </div>\`;

                    container.innerHTML = bekleyenHtml + gecmisHtml;
                } else {
                    container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">' + (data.message || 'Veriler çekilemedi.') + '</div>';
                }
            } catch (e) {
                console.error(e);
                container.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">Sunucu hatası oluştu.</div>';
            }
        }

        function previewPendingArticle(id) {
            const item = (window.PENDING_ITEMS_CACHE || []).find(b => b.id === id);
            if (!item) return;
            document.getElementById('prev-title').textContent = item.title;
            document.getElementById('prev-meta').textContent = \`Yazar: \${item.authorName}  •  Tarih: \${new Date(item.submittedAt).toLocaleString('tr-TR')}\`;
            document.getElementById('prev-content').textContent = item.content;
            document.getElementById('pending-preview-modal').style.display = 'flex';
        }

        function closePendingPreviewModal() {
            document.getElementById('pending-preview-modal').style.display = 'none';
        }

        async function processPendingArticle(id, action) {
            /* Reddederken gerekçe İSTENİR: yazar bu gerekçeyi kendi ekranında
               görüp yazıyı düzeltip tekrar gönderebiliyor. Gerekçesiz red,
               yazarın neyi düzelteceğini bilememesi demek. */
            let redSebebi = '';
            if (action === 'reject') {
                const girilen = prompt('Bu yazı neden reddediliyor?\\n\\nYazacağınız gerekçe yazara gösterilecek ve düzeltip tekrar gönderebilecek.\\n(Boş bırakabilirsiniz)');
                if (girilen === null) return; // vazgeçildi
                redSebebi = girilen.trim();
            } else {
                if (!confirm('Bu yazıyı onaylayıp kütüphanede yayınlamak istediğinizden emin misiniz?')) return;
            }

            const box = document.getElementById('pending-durum-box');
            box.style.background = 'rgba(59,130,246,0.15)';
            box.style.color = '#93c5fd';
            box.style.border = '1px solid #3b82f6';
            box.textContent = '⏳ İşlem yapılıyor ve kütüphane güncelleniyor, lütfen bekleyin...';
            box.style.display = 'block';

            try {
                const u = localStorage.getItem('username') || '';
                const p = localStorage.getItem('password') || '';
                const res = await fetch('/api/approve-pending-article', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: u,
                        password: p,
                        id: id,
                        action: action,
                        redSebebi: redSebebi
                    })
                });

                const data = await res.json();
                if (data.success) {
                    box.style.background = 'rgba(34,197,94,0.15)';
                    box.style.color = '#86efac';
                    box.style.border = '1px solid #22c55e';
                    box.textContent = '✅ ' + data.message;
                    await fetchAndRenderPendingArticles();
                } else {
                    box.style.background = 'rgba(239,68,68,0.15)';
                    box.style.color = '#fca5a5';
                    box.style.border = '1px solid #ef4444';
                    box.textContent = '❌ ' + (data.message || 'İşlem başarısız.');
                }
            } catch (e) {
                console.error(e);
                box.style.background = 'rgba(239,68,68,0.15)';
                box.style.color = '#fca5a5';
                box.style.border = '1px solid #ef4444';
                box.textContent = '❌ Sunucu ile iletişim hatası oluştu.';
            }
        }

        document.addEventListener('DOMContentLoaded', loadPendingCount);

        /* ── DENETİM ROLÜ İÇİN SADELEŞTİRME ───────────────────────────────
           Denetim yetkisi olan kişi de bu sayfaya girer, ama işi yalnızca
           yazı onaylamaktır. Kendisini ilgilendirmeyen düğmeler gizlenir.
           BU SADECE GÖRSEL BİR SADELEŞTİRME — asıl engelleme sunucuda:
           /api/set-role ve /api/sync yönetici olmayanı zaten reddediyor.
           Düğmeyi gizlemek yetki değildir, o yüzden ikisi bir arada. */
        document.addEventListener('DOMContentLoaded', function () {
            const rol = localStorage.getItem('userRole') || '';
            if (rol !== 'denetim') return;

            document.querySelectorAll('.header-actions .btn-act').forEach(el => {
                const t = (el.textContent || '');
                const korunacak = t.includes('Onay Bekleyen') || t.includes('Kütüphaneye Dön');
                if (!korunacak) el.style.display = 'none';
            });

            const baslik = document.querySelector('header h1');
            if (baslik) {
                const not = document.createElement('div');
                not.style.cssText = 'font-size:0.8rem; color:#38bdf8; margin-top:6px; font-weight:600;';
                not.textContent = '🛡️ Denetim yetkisiyle giriş yaptınız — yazı onaylayabilirsiniz (kendi yazılarınız hariç).';
                baslik.parentNode.insertBefore(not, baslik.nextSibling);
            }
        });
    </script>

    <!-- ══ Yönetici Şifre Değiştirme Modalı ══ -->
    <div id="change-pwd-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:1000; justify-content:center; align-items:center;">
        <div style="background:#22222a; border:1px solid #3a3a46; border-radius:14px; padding:28px; width:min(480px, 92vw); color:#fff; box-shadow:0 20px 50px rgba(0,0,0,0.6);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3a3a46; padding-bottom:14px; margin-bottom:20px;">
                <h3 style="margin:0; font-size:1.2rem; color:#e1b12c;">🔑 Yönetici Şifresini Değiştir</h3>
                <button onclick="closeChangePasswordModal()" style="background:none; border:none; color:#aaa; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div id="adm-pwd-durum" style="display:none; padding:12px; border-radius:8px; font-size:0.88rem; margin-bottom:16px;"></div>

            <div class="form-satir">
                <label>Mevcut Kullanıcı Adı:</label>
                <input type="text" id="adm-cur-user" placeholder="erdem.ozkur">
            </div>

            <div class="form-satir">
                <label>Yeni Yönetici Kullanıcı Adı:</label>
                <input type="text" id="adm-new-user" placeholder="erdem.ozkur">
            </div>

            <div class="form-satir">
                <label>Mevcut Yönetici Şifresi:</label>
                <input type="password" id="adm-cur-pwd" placeholder="••••••••">
            </div>

            <div class="form-satir">
                <label>Yeni Şifre:</label>
                <input type="password" id="adm-new-pwd" placeholder="••••••••">
            </div>

            <div class="form-satir">
                <label>Yeni Şifre (Tekrar):</label>
                <input type="password" id="adm-new-pwd-confirm" placeholder="••••••••">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                <button type="button" onclick="closeChangePasswordModal()" class="btn-act" style="background:#374151;">İptal</button>
                <button type="button" onclick="submitAdminPasswordChange()" class="btn-act" style="background:#e1b12c; color:#111; border-color:#e1b12c; font-weight:700;">💾 Şifreyi Güncelle</button>
            </div>
        </div>
    </div>

    <!-- ══ Kullanıcı Yetkileri (Rol) Modalı ══ -->
    <div id="roles-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:1000; justify-content:center; align-items:center;">
        <div style="background:#22222a; border:1px solid #3a3a46; border-radius:14px; padding:26px; width:min(820px, 94vw); max-height:85vh; display:flex; flex-direction:column; color:#fff; box-shadow:0 20px 50px rgba(0,0,0,0.6); overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3a3a46; padding-bottom:14px; margin-bottom:14px;">
                <h3 style="margin:0; font-size:1.2rem; color:#a78bfa;">👥 Kullanıcı Yetkileri</h3>
                <button onclick="closeRolesModal()" style="background:none; border:none; color:#aaa; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>

            <div style="background:#18181c; border:1px solid #2d2d38; border-radius:8px; padding:11px 14px; margin-bottom:14px; font-size:0.79rem; color:#9ca3af; line-height:1.7;">
                <b style="color:#e5e7eb;">Yönetici</b> — her şeyi yapabilir, yetki atayabilir &nbsp;•&nbsp;
                <b style="color:#e5e7eb;">Denetim</b> — yazı onaylar/reddeder (<u>kendi yazısı hariç</u>) &nbsp;•&nbsp;
                <b style="color:#e5e7eb;">Yazar</b> — yalnızca kendi yazılarını gönderir &nbsp;•&nbsp;
                <b style="color:#e5e7eb;">Okuyucu</b> — yalnızca okur
            </div>

            <div id="roles-durum-box" style="display:none; padding:11px; border-radius:8px; font-size:0.86rem; margin-bottom:12px;"></div>

            <input id="roles-arama" oninput="rolleriFiltrele()" placeholder="🔍 İsim ara..." style="background:#18181c; border:1px solid #3a3a46; color:#fff; border-radius:8px; padding:9px 12px; font-size:0.86rem; margin-bottom:12px; outline:none;">

            <div id="roles-container" style="flex:1; overflow-y:auto; padding-right:6px;">
                <div style="color:#aaa; text-align:center; padding:20px;">Yükleniyor...</div>
            </div>

            <div style="text-align:right; margin-top:14px; border-top:1px solid #3a3a46; padding-top:12px;">
                <button onclick="closeRolesModal()" class="btn-act" style="background:#4b5563;">Kapat</button>
            </div>
        </div>
    </div>

    <!-- ══ Onay Bekleyen Yazılar Modalı ══ -->
    <div id="pending-articles-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.8); z-index:1000; justify-content:center; align-items:center;">
        <div style="background:#22222a; border:1px solid #3a3a46; border-radius:14px; padding:26px; width:min(780px, 94vw); max-height:85vh; display:flex; flex-direction:column; color:#fff; box-shadow:0 20px 50px rgba(0,0,0,0.6); overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3a3a46; padding-bottom:14px; margin-bottom:16px;">
                <h3 style="margin:0; font-size:1.2rem; color:#38bdf8;">📩 Yazarlardan Gelen Onay Bekleyen Yazılar</h3>
                <button onclick="closePendingArticlesModal()" style="background:none; border:none; color:#aaa; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div id="pending-durum-box" style="display:none; padding:12px; border-radius:8px; font-size:0.88rem; margin-bottom:14px;"></div>

            <div id="pending-articles-container" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:12px; padding-right:6px;">
                <!-- Dynamically populated pending items -->
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:16px; border-top:1px solid #3a3a46; padding-top:14px;">
                <button type="button" onclick="closePendingArticlesModal()" class="btn-act" style="background:#374151;">Kapat</button>
            </div>
        </div>
    </div>

    <!-- ══ Yazı İçeriği Önizleme Modalı ══ -->
    <div id="pending-preview-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:1100; justify-content:center; align-items:center;">
        <div style="background:#1e1e24; border:1px solid #3a3a46; border-radius:14px; padding:24px; width:min(720px, 92vw); max-height:85vh; display:flex; flex-direction:column; color:#fff;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3a3a46; padding-bottom:12px; margin-bottom:14px;">
                <h3 id="prev-title" style="margin:0; font-size:1.1rem; color:#e1b12c;">Yazı İçeriği Önizleme</h3>
                <button onclick="closePendingPreviewModal()" style="background:none; border:none; color:#aaa; font-size:1.4rem; cursor:pointer;">&times;</button>
            </div>
            <div id="prev-meta" style="font-size:0.85rem; color:#9ca3af; margin-bottom:12px;"></div>
            <div id="prev-content" style="flex:1; overflow-y:auto; background:#141418; border:1px solid #2d2d38; border-radius:8px; padding:16px; font-size:0.95rem; line-height:1.6; white-space:pre-wrap; color:#e5e7eb;"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
                <button onclick="closePendingPreviewModal()" class="btn-act" style="background:#374151;">Kapat</button>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function build() {
    if (!fs.existsSync('veritabani/yazarlar_veritabani.json')) {
        console.error("Veritabanı yok!");
        return;
    }
    
    const authors = JSON.parse(fs.readFileSync('veritabani/yazarlar_veritabani.json', 'utf-8'));
    
    const libraryHtml = createLibraryHTML(authors);
    fs.writeFileSync('mektep_kutuphane.html', libraryHtml);
    console.log("✓ Kütüphane arayüzü (mektep_kutuphane.html) oluşturuldu.");

    const adminHtml = createAdminHTML(authors);
    fs.writeFileSync('mektep_yonetim.html', adminHtml);
    console.log("✓ Yönetici & İstatistik paneli (mektep_yonetim.html) oluşturuldu.");

    /* Giriş sayfasının çevrimdışı doğrulaması için kullanıcı adı listesi.
       SADECE kullanıcı adı + görünen ad + kart kimliği yazılır — ŞİFRE YOK
       (yazarlar_veritabani.json bilerek web sayfasına konmuyor, aynı gerekçe).
       login.html sunucuya ulaşamadığında bu listeyle kullanıcı adını
       doğruluyor; eskiden hiç kontrol etmiyordu ve yanlış kullanıcı adı
       sessizce "giriş yapıp" boş raf gösteriyordu. */
    const kullanicilar = {};
    authors.forEach(a => {
        if (!a.username) return;
        kullanicilar[a.username.trim().toLocaleLowerCase('tr')] = {
            name: a.name,
            id: a.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()
        };
    });
    fs.writeFileSync(
        'yazar_kullanicilari.js',
        '/* build_library.js tarafından üretilir — ELLE DÜZENLEME. Şifre içermez. */\n'
        + 'window.YAZAR_KULLANICILARI = ' + JSON.stringify(kullanicilar, null, 1) + ';\n'
    );
    console.log(`✓ Yazar kullanıcı adı listesi (yazar_kullanicilari.js) — ${Object.keys(kullanicilar).length} kayıt.`);
}

build();