const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const BASE_URL = 'https://mektep.ozkurbir.org/';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Axios'un varsayılan zaman aşımı SONSUZDUR — site yanıt vermediğinde tarama
// süresiz asılı kalıyordu. Her istek artık en fazla 45 sn bekler ve başarısız
// olursa artan aralıklarla 3 kez denenir. (Site yoğun saatlerde tek istek
// 12-15 sn sürebiliyor, bu yüzden sınır bilerek geniş tutuldu.)
const ISTEK_ZAMAN_ASIMI = 45000;
const MAX_DENEME = 3;

/* Başlık karşılaştırma anahtarı — server.js'teki basligiNormalize ile BİREBİR
   AYNI olmalı (ikisi de "bir yazarda aynı başlıktan tek kayıt" kuralını
   uyguluyor; biri taramada, diğeri elle girişte). Tırnak çeşitleri tek biçime
   indirgenir, aksanlar atılır, büyük harfe çevrilir, boşluklar sadeleşir. */
function basligiNormalize(baslik) {
    return (baslik || '')
        .replace(/[‘’ʼ´`]/g, "'")
        .replace(/[“”«»]/g, '"')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();
}

async function istekAt(url) {
    let sonHata;
    for (let deneme = 1; deneme <= MAX_DENEME; deneme++) {
        try {
            return await axios.get(url, { timeout: ISTEK_ZAMAN_ASIMI });
        } catch (e) {
            sonHata = e;
            const zamanAsimi = e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT';
            console.log(`    (deneme ${deneme}/${MAX_DENEME} başarısız${zamanAsimi ? ' — zaman aşımı' : ''}: ${url})`);
            if (deneme < MAX_DENEME) await sleep(2000 * deneme);
        }
    }
    throw sonHata;
}

async function getAuthors() {
    console.log("Ana sayfa yükleniyor...");
    const res = await istekAt(BASE_URL);
    const $ = cheerio.load(res.data);
    
    const authors = {};
    
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        const name = $(el).text().trim();
        if (href && href.startsWith('kategori/') && name && !authors[name]) {
            authors[name] = {
                name: name,
                categoryUrl: BASE_URL + href,
                articles: []
            };
        }
    });
    
    console.log(`${Object.keys(authors).length} farklı yazar bulundu.`);
    return Object.values(authors);
}

async function scrapeAuthor(author) {
    console.log(`\nYazar taranıyor: ${author.name}`);
    let page = 1;
    let hasNext = true;
    
    while (hasNext) {
        // Correct pagination URL builder
        let pageUrl;
        if (author.categoryUrl.includes('/sayfa/')) {
            pageUrl = author.categoryUrl.split('/sayfa/')[0] + '/sayfa/' + page;
        } else {
            pageUrl = author.categoryUrl + '/sayfa/' + page;
        }

        try {
            const res = await istekAt(pageUrl);
            const $ = cheerio.load(res.data);
            
            const articles = $('article.entry.card');
            if (articles.length === 0) {
                hasNext = false;
                break;
            }
            
            let foundNew = false;
            for (let i = 0; i < articles.length; i++) {
                const el = articles[i];
                const title = $(el).find('h2.entry__title a').text().trim();
                const link = $(el).find('h2.entry__title a').attr('href');
                const date = $(el).find('.entry__meta-date').text().trim();
                
                if (title && link) {
                    const articleUrl = BASE_URL + link;

                    // Yinelenme kontrolü URL'e EK OLARAK başlığa da bakar
                    // (2026-08-06). Sadece URL'e bakıldığı için aynı yazı
                    // farklı adresle yeniden yayımlandığında ikinci kez
                    // ekleniyordu — veritabanında EMİN KEVEN'de böyle bir çift
                    // oluşmuştu. Kullanıcı kuralı: bir yazarda aynı başlıktan
                    // yalnızca tek kayıt bulunur.
                    const baslikAnahtari = basligiNormalize(title);
                    const zatenVar = author.articles.some(a =>
                        a.url === articleUrl ||
                        basligiNormalize(a.title) === baslikAnahtari
                    );

                    if (!zatenVar) {
                        foundNew = true;
                        console.log(`  - Yazı bulundu: ${title}`);
                        
                        try {
                            const artRes = await istekAt(articleUrl);
                            const $art = cheerio.load(artRes.data);
                            let content = $art('.entry__article').html() || $art('.post-content').html() || $art('.blog__content').html() || "";
                            
                            if(content) {
                               const $c = cheerio.load(content);
                               $c('script, style, .socials, .widget, .entry__tags, .tags').remove();
                               content = cleanBookTypography($c.text());
                            }

                            author.articles.push({
                                title,
                                date,
                                url: articleUrl,
                                content: content
                            });
                        } catch(e) {
                            console.log(`    (Hata: Yazı içeriği çekilemedi: ${articleUrl})`);
                        }
                        await sleep(500); 
                    }
                }
            }
            
            if (!foundNew) {
                hasNext = false; // We just saw a page with articles we already have -> end of pages
            } else {
                page++;
                if (page > 10) hasNext = false;
            }
            
        } catch (e) {
            hasNext = false;
        }
    }
}

async function main() {
    console.log("🔍 mektep.ozkurbir.org Taranıyor ve Veritabanı Güncelleniyor...\n");

    let existingAuthors = [];
    if (fs.existsSync('yazarlar_veritabani.json')) {
        try {
            existingAuthors = JSON.parse(fs.readFileSync('yazarlar_veritabani.json', 'utf-8'));
            console.log(`📦 Mevcut veritabanında ${existingAuthors.length} yazar kayıtlı.`);
        } catch (e) {
            console.error("Mevcut veritabanı okunamadı, yeni oluşturulacak.");
        }
    }

    const authorsMap = {};
    existingAuthors.forEach(a => {
        authorsMap[a.name] = a;
    });

    const currentAuthors = await getAuthors();
    
    for (const ca of currentAuthors) {
        if (!authorsMap[ca.name]) {
            authorsMap[ca.name] = ca;
        } else {
            authorsMap[ca.name].categoryUrl = ca.categoryUrl;
        }
    }

    const allAuthors = Object.values(authorsMap);
    console.log(`\n📚 Toplam ${allAuthors.length} yazar kontrol edilecek.\n`);

    let newArticlesCount = 0;
    for (let i = 0; i < allAuthors.length; i++) {
        const author = allAuthors[i];
        if (!author.articles) author.articles = [];
        
        const prevCount = author.articles.length;
        await scrapeAuthor(author);
        const added = author.articles.length - prevCount;
        newArticlesCount += added;
    }

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

    function mergeAuthorsWithTitles(authorsList) {
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

    const finalAuthors = mergeAuthorsWithTitles(allAuthors);
    fs.writeFileSync('yazarlar_veritabani.json', JSON.stringify(finalAuthors, null, 2));
    console.log(`\n✅ İşlem Tamamlandı! ${newArticlesCount} yeni yazı eklendi. Toplam ${finalAuthors.length} yazar derlendi.`);
    console.log("💾 Güncel veriler yazarlar_veritabani.json dosyasına başarıyla kaydedildi!");
}

main();
