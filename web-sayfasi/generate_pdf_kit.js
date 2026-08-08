const PDFDocument = require('pdfkit');
const fs = require('fs');

const MM_TO_PT = 2.83465;

/* Paragraflar arasındaki boşluk — 2026-08-06'da kullanıcı isteğiyle "bir satır
   boşluk" yapıldı (önceki değer 6 pt, yani yarım satırdan az). Gövde metni
   fontSize 11 + lineGap 3.75 ile diziliyor, dolayısıyla tam bir satır 14.75 pt.
   ÖNEMLİ: bu değer hem dizgide (`paragraphGap`) hem de sayfa dağılımını önceden
   hesaplayan İKİ simülasyonda (`calculateArticleGap`, `calculateArticleStartPages`)
   kullanılır — üçü ayrışırsa yetim-başlık koruması ve İçindekiler numaraları
   kayar. Değiştirirken üçünü birden düşün. */
const PARAGRAF_ARASI = 11 + 3.75;   // 14.75 pt = tam bir satır

// Tam sayfa kapak görselleri (ikisi de `` altında, teslim edilen
// pakette de bulunur). Arka kapak 2026-08-05'te eklendi; kullanıcının onayladığı
// basılı kapak mockup'ından ayıklanıp A4 oranına getirildi.
const ON_KAPAK = 'kapak.png';
const ARKA_KAPAK = 'arkakapak.png';

// Renk Paleti
const COLORS = {
    ana: '#1E4E79',
    ikinci: '#3B82F6',
    vurgu: '#F59E0B',
    arkaPlan: '#FFFFFF',
    kutu: '#F8F9FA',
    gri: '#4B5563',
    acikGri: '#E5E7EB'
};

// Kitabın 2. sayfası (kapağın iç yüzü) = KÜNYE. Yayıncı kimliği, seri bilgisi,
// eserin künye tablosu, telif notu ve iletişim. Eksik olduğu için BİLİNÇLİ
// KONULMAYAN alanlar: Sertifika No, ISBN, Yayın Yönetmeni, Editör, matbaa
// bilgileri — değerleri gelince buraya satır olarak eklenir (uydurulmadı).
const AYLAR_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function yaziDonemi(articles) {
    const ayIdx = {};
    AYLAR_TR.forEach((a, i) => { ayIdx[a] = i; });
    const noktalar = [];
    (articles || []).forEach(a => {
        const m = /^(\d{1,2})-(\S+)-(\d{4})$/.exec((a.date || '').trim());
        if (m && ayIdx[m[2]] !== undefined) noktalar.push([Number(m[3]), ayIdx[m[2]]]);
    });
    if (!noktalar.length) return null;
    noktalar.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const [iy, ia] = noktalar[0], [sy, sa] = noktalar[noktalar.length - 1];
    if (iy === sy && ia === sa) return `${AYLAR_TR[ia]} ${iy}`;
    if (iy === sy) return `${AYLAR_TR[ia]} – ${AYLAR_TR[sa]} ${iy}`;
    return `${AYLAR_TR[ia]} ${iy} – ${AYLAR_TR[sa]} ${sy}`;
}

// Altın Selçuklu ayracı (makale arası ayraçla aynı dil, kırmızısız)
function kunyeAyrac(doc, merkezX, y, yariGenislik) {
    doc.save();
    doc.moveTo(merkezX - yariGenislik, y).lineTo(merkezX - 14, y).lineWidth(0.7).strokeColor('#c9a227').stroke();
    doc.moveTo(merkezX + 14, y).lineTo(merkezX + yariGenislik, y).lineWidth(0.7).strokeColor('#c9a227').stroke();
    doc.save();
    doc.translate(merkezX, y);
    doc.rotate(45);
    doc.rect(-3.4, -3.4, 6.8, 6.8).lineWidth(0.9).fillAndStroke('#c9a227', '#b8935a');
    doc.restore();
    doc.restore();
}

function drawKunye(doc, author, fonts, margins, bilgi) {
    const LACI = '#1c3050', ALTIN = '#b8935a', GRI = '#6b7280', ACIK = '#9ca3af';
    const W = doc.page.width;
    const orta = W / 2;
    const genislik = W - margins.left - margins.right;
    const ortala = { align: 'center', width: genislik };

    const ustMarj = doc.page.margins.top, altMarj = doc.page.margins.bottom;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;

    // — Yayıncı kimliği —
    kunyeAyrac(doc, orta, 118, 44);
    doc.font(fonts.headingBold).fontSize(13).fillColor(LACI)
       .text('ÖZKURBİR YAYINLARI', margins.left, 136, { ...ortala, characterSpacing: 3.2 });
    doc.font(fonts.regular).fontSize(8.5).fillColor(GRI)
       .text('Özel Öğretim Kurumları Birliği Derneği', margins.left, 158, ortala);

    kunyeAyrac(doc, orta, 182, 120);

    // — Seri —
    doc.font(fonts.headingBold).fontSize(15).fillColor(LACI)
       .text('MEKTEP KÜTÜPHANESİ', margins.left, 204, { ...ortala, characterSpacing: 2.2 });
    doc.font(fonts.regular).fontSize(10).fillColor(ALTIN)
       .text('Mektep Dergisi’nden Seçilmiş Yazılar', margins.left, 228, ortala);
    doc.font(fonts.semiBold).fontSize(8).fillColor(ACIK)
       .text('DÜŞÜNCE  ·  EĞİTİM  ·  KÜLTÜR  ·  MEDENİYET', margins.left, 246, { ...ortala, characterSpacing: 1.4 });

    kunyeAyrac(doc, orta, 270, 120);

    // — Eser — (kapakla aynı yalın düzen: sadece yazar adı. Eskiden altında
    //   "Eğitimci Yazar" yazıyordu, kaldırıldı; bkz. kapak notu.)
    doc.font(fonts.headingBold).fontSize(19).fillColor(LACI)
       .text(author.name, margins.left, 300, ortala);
    let y = 342;
    if ((author.totalVolumes || 1) > 1) {
        doc.font(fonts.semiBold).fontSize(9).fillColor(GRI)
           .text(`Kitap ${author.volumeIndex} / ${author.totalVolumes}`, margins.left, y, ortala);
        y += 18;
    }

    // — Künye tablosu — etiketler sağa, değerler sola hizalı (klasik künye düzeni)
    const donem = yaziDonemi(author.articles);
    const satirlar = [
        ['Seri', 'Mektep Kütüphanesi'],
        ['ISSN', '3149-8418'],
        ['Yayın Yönetmeni', 'Doç. Dr. Erdal KILIÇ'],
        ['Yayın Kurulu', 'Cengiz Dinçer, Erbin Soygür, Mehmet Kutlu'],
        ['Yazılım, Kapak ve İç Tasarım', 'Mehmet Kutlu'],
        ['Derleme', 'Mektep Dergisi · mektep.ozkurbir.org'],
        ['İçerik', `${author.articles.length} yazı · ${bilgi.sayfaSayisi} sayfa`],
    ];
    if (donem) satirlar.push(['Yazı Dönemi', donem]);
    satirlar.push(['Basım', bilgi.basim]);

    const etiketSonX = margins.left + 168, degerX = margins.left + 181;
    y = Math.max(y + 24, 380);
    satirlar.forEach(([etiket, deger]) => {
        doc.font(fonts.semiBold).fontSize(8.5).fillColor(ACIK)
           .text(etiket, margins.left, y + 1, { width: etiketSonX - margins.left, align: 'right' });
        doc.font(fonts.regular).fontSize(9.5).fillColor(LACI)
           .text(deger, degerX, y, { width: W - degerX - margins.left });
        y += 19;
    });

    kunyeAyrac(doc, orta, y + 16, 120);

    // — Telif —
    doc.font(fonts.semiBold).fontSize(9).fillColor(LACI)
       .text(`© ${bilgi.yil} ÖZKURBİR Özel Öğretim Kurumları Birliği Derneği`, margins.left, y + 42, ortala);
    doc.font(fonts.regular).fontSize(8.5).fillColor(GRI)
       .text('Bu kitapçıktaki yazıların telif hakları yazarlarına aittir. Derleme ve yayın hakları ÖZKURBİR Yayınları’na aittir. Kaynak gösterilmeksizin çoğaltılamaz, alıntılanamaz.',
             margins.left + 60, y + 62, { align: 'center', width: genislik - 120, lineGap: 2.5 });

    // — İletişim (sayfa altı) —
    const altY = doc.page.height - 118;
    doc.moveTo(orta - 90, altY).lineTo(orta + 90, altY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.font(fonts.regular).fontSize(8.2).fillColor(GRI)
       .text('Barbaros Hayrettin Paşa Mh, Necip Fazıl Kısakürek Cd No:17', margins.left, altY + 14, ortala)
       .text('34515, 34522 Esenyurt / İstanbul', margins.left, altY + 26, ortala);
    doc.font(fonts.semiBold).fontSize(8.2).fillColor(LACI)
       .text('www.ozkurbir.org  ·  mektep.ozkurbir.org  ·  info@ozkurbir.org', margins.left, altY + 44, ortala);
    doc.font(fonts.regular).fontSize(8.2).fillColor(ACIK)
       .text('ozkurbir.official', margins.left, altY + 58, ortala);

    doc.page.margins.top = ustMarj;
    doc.page.margins.bottom = altMarj;
}

function calculateArticleGap(doc, art, index, docY, margins, fonts, COLORS) {
    if (index === 0) return 0;
    
    const lineSpacing = 11 + 3.3; // 14.3 pt (satır aralığı %50 artırıldı)
    const textWidth = doc.page.width - margins.left - margins.right;
    
    const remainingSpace = doc.page.height - margins.bottom - docY;
    const spaceNeeded = 300; // Yetim başlık ve dar sayfa sonu başlangıçlarını önlemek için en az 300pt (10cm) yer gerekli
    if (remainingSpace < spaceNeeded) {
        return 0; 
    }
    
    // Save current font state
    const activeFont = doc._font;
    const activeFontSize = doc._fontSize;
    
    // Measure title (tarih satırı kaldırıldı — bkz. dizgi bloğundaki not)
    doc.font(fonts.heading).fontSize(18);
    const titleHeight = doc.heightOfString(art.title, { width: textWidth });
    const headerHeight = titleHeight + 20;
    
    const rawContent = art.content.replace(/\r/g, '');
    const paragraphs = rawContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    const checkGap = (gapLines) => {
        const gapVal = gapLines * lineSpacing;
        let y = docY + gapVal + headerHeight;
        let pageCount = 0;
        let hasBadSplit = false;
        
        doc.font(fonts.regular).fontSize(11);
        for (let p of paragraphs) {
            const pText = p.trim();
            const pHeight = doc.heightOfString(pText, { width: textWidth, lineGap: 3.3 });
            let pRemaining = doc.page.height - margins.bottom - y;
            
            if (pHeight > pRemaining) {
                const linesThatFit = Math.floor(pRemaining / lineSpacing);
                const totalLines = Math.round(pHeight / lineSpacing);
                const linesOnNextPage = totalLines - linesThatFit;
                
                if (linesThatFit < 3 || linesOnNextPage < 3 || pRemaining < 55) {
                    y = margins.top;
                    pageCount++;
                    if (pageCount === 1) {
                        hasBadSplit = true;
                    }
                } else {
                    y = margins.top;
                    pageCount++;
                }
            } else {
                y += pHeight + PARAGRAF_ARASI;   // dizgideki paragraphGap ile aynı
            }
        }
        return { pageCount, hasBadSplit };
    };
    
    const result3 = checkGap(3);
    let selectedGap = 3;
    
    if (result3.hasBadSplit) {
        const result2 = checkGap(2);
        if (!result2.hasBadSplit) {
            selectedGap = 2;
        } else {
            const result1 = checkGap(1);
            if (!result1.hasBadSplit) {
                selectedGap = 1;
            }
        }
    }
    
    // Restore font state
    if (activeFont) {
        doc._font = activeFont;
    }
    doc.fontSize(activeFontSize);
    
    return selectedGap;
}

function calculateArticleStartPages(author, margins, fonts, COLORS) {
    const doc = new PDFDocument({ size: 'A4', margins: margins });
    const textWidth = doc.page.width - margins.left - margins.right;
    const lineSpacing = 11 + 3.3; // satır aralığı %50 artırıldı
    
    // 1. Calculate TOC pages
    let y = margins.top + 50; 
    let tocPages = 1;
    author.articles.forEach((art) => {
        doc.font(fonts.heading).fontSize(11);
        const titleH = doc.heightOfString(art.title, { width: textWidth - 40 });
        // İçindekiler zaten tarihsiz basılıyor; ölçüm de tarihsiz.
        const itemH = titleH + 15;
        
        if (y + itemH > doc.page.height - margins.bottom) {
            y = margins.top;
            tocPages++;
        }
        y += itemH;
    });
    
    // 2. Simulate articles flow
    const startPages = [];
    let currentPage = 1 + tocPages + 1; 
    let currentY = margins.top;
    
    author.articles.forEach((art, index) => {
        if (index > 0) {
            const spaceNeeded = 300;
            const remainingSpace = doc.page.height - margins.bottom - currentY;
            if (remainingSpace < spaceNeeded) {
                currentPage++;
                currentY = margins.top;
            } else {
                const gapLines = calculateArticleGap(doc, art, index, currentY, margins, fonts, COLORS);
                currentY += gapLines * lineSpacing;
            }
        }
        
        startPages.push(currentPage);
        
        // Measure title (tarih satırı kaldırıldı — bkz. dizgi bloğundaki not)
        doc.font(fonts.heading).fontSize(18);
        const titleH = doc.heightOfString(art.title, { width: textWidth });
        currentY += titleH + 20;
        
        // Measure paragraphs
        const rawContent = art.content.replace(/\r/g, '');
        const paragraphs = rawContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        doc.font(fonts.regular).fontSize(11);
        paragraphs.forEach(p => {
            const pText = p.trim();
            const pHeight = doc.heightOfString(pText, { width: textWidth, lineGap: 3.3 });
            const remainingSpace = doc.page.height - margins.bottom - currentY;
            
            if (pHeight > remainingSpace) {
                const linesThatFit = Math.floor(remainingSpace / lineSpacing);
                const totalLines = Math.round(pHeight / lineSpacing);
                const linesOnNextPage = totalLines - linesThatFit;
                
                if (linesThatFit < 3 || linesOnNextPage < 3 || remainingSpace < 55) {
                    currentPage++;
                    currentY = margins.top + pHeight + PARAGRAF_ARASI;
                } else {
                    currentPage++;
                    currentY = margins.top + (linesOnNextPage * lineSpacing) + PARAGRAF_ARASI;
                }
            } else {
                currentY += pHeight + PARAGRAF_ARASI;   // dizgideki paragraphGap ile aynı
            }
        });
    });
    
    doc.end();
    return startPages;
}

// `olcum` verilirse, her makalenin BASILI sayfa numarası (dizgi sırasında
// gerçekten düştüğü sayfa) bu diziye yazılır. main() bunu iki geçişli üretimde
// İçindekiler numaralarını doğrulamak/düzeltmek için kullanır.
function createAuthorPDF(author, outputPath, olcum) {
    return new Promise((resolve, reject) => {
        const margins = {
            top: 30 * MM_TO_PT, // Metinlerin başlayacağı Y hizası (Tüm sayfalarda aynı)
            bottom: 20 * MM_TO_PT,
            left: 20 * MM_TO_PT,
            right: 20 * MM_TO_PT
        };

        const doc = new PDFDocument({
            size: 'A4',
            margins: margins,
            bufferPages: true,
            info: {
                Title: author.name + " - Mektep Kütüphanesi",
                Author: "Özkurbir",
                Subject: "Seçme Yazılar",
                /* SABİT ÜRETİM TARİHİ — kaldırma.
                   PDFKit varsayılan olarak o anın saatini PDF'e gömer. Bunun
                   sonucu: içerik hiç değişmese bile her üretimde dosya baytları
                   farklı çıkıyordu, yani her yazar için 3 MB'lık sahte
                   değişiklik. Yazılar sunucudan eklendiğinde bu dosyaların
                   GitHub'a geri yazılması gerektiği için, sahte değişiklikler
                   depoyu boş yere şişirirdi. Sabit tarih verilince aynı içerik
                   → aynı bayt; sadece GERÇEKTEN değişen yazar güncellenir. */
                CreationDate: SABIT_TARIH,
                ModDate: SABIT_TARIH
            }
        });

        // Font Yüklemeleri
        const fonts = {
            regular: fs.existsSync('Roboto-Regular.ttf') ? 'Roboto-Regular.ttf' : 'Helvetica',
            semiBold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            bold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            heading: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            headingBold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold'
        };

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // --- Kapak Sayfası (kullanıcı tasarımı: kapak.png, tam sayfa) ---
        doc.image(ON_KAPAK, 0, 0, { width: doc.page.width, height: doc.page.height });

        // Yazar Adı ve Künyesi — "MEKTEP KÜTÜPHANESİ" başlığı ile "DÜŞÜNCE •
        // EĞİTİM • KÜLTÜR • MEDENİYET" etiketi arasındaki iki süsleme çizgisinin
        // arasındaki boş alana ORTALANARAK yazılır.
        //
        // 2026-08-06 ÖLÇÜMÜ (kapak.png 1131x1600, ölçek 1px = 841.89/1600 = 0.5262pt):
        //   üst süsleme çizgisi  y = 889.5 px → 468.0 pt
        //   alt süsleme çizgisi  y = 1034.5 px → 544.3 pt
        //   aradaki boşluk       = 145 px → 76.3 pt (önceki kapakta 62.6 pt idi,
        //                          yani %22 genişledi → yazı büyütülüp yeniden ortalandı)
        //   boşluk merkezi       = 506.2 pt
        //   blok = isim(19x1.15=21.9) + 6 boşluk + unvan(11x1.15=12.7) = 40.5 pt
        //   isim üstü = 485 ; unvan üstü = 513 (PDF'ten ölçülen gerçek kutulara göre
        //                          1 pt aşağı kaydırıldı → üst 17.0 pt / alt 16.8 pt)
        //   → üstte 18 pt, altta ~18 pt eşit pay kalıyor.
        //
        // Kapak BİR DAHA değişirse bu iki çizginin piksel konumu yeniden ölçülüp
        // buradaki y/fontSize değerleri VE build_library.js'teki
        // .cover-author-overlay CSS'i BİRLİKTE elden geçirilmeli
        // (ölçüm yöntemi: SESSION_STATE.md).
        // Kapakta SADECE yazar adı yer alır (2026-08-06 kullanıcı isteği).
        // Tarihçe: önce ismin altında "Eğitimci Yazar" yazıyordu — ancak
        // veritabanındaki 62 yazarın HİÇBİRİNDE `title` alanı olmadığı için bu,
        // herkese uygulanan yanlış bir varsayımdı. Kısa süre "Yazar" etiketiyle
        // değiştirildi, sonra o da kaldırıldı; kapak artık yalın.
        // Konum: isim(21x1.15≈24.2) tek başına, boşluğun (468.0–544.3) merkezine
        // ortalanır. PDF'ten ölçülüp ayarlandı → üst 24.0 pt / alt 24.6 pt.
        doc.font(fonts.headingBold).fontSize(21).fillColor('#1c3050').text(author.name, margins.left, 492, { align: 'center' });

        // Üretim tarihi bilgisi. KAPAĞA BASILMIYOR — 2026-08-06'da kullanıcı
        // isteğiyle kaldırıldı. (Eskiden kapağın en altında
        // "ÖZKURBİR YAYINLARI · 6 Ağustos 2026" satırı vardı; sayfa alt
        // marjininin dışına düştüğü için `doc.page.margins.bottom` geçici
        // olarak sıfırlanıyordu, o hile de artık gereksiz olduğu için silindi.)
        // Bu değişkenler hâlâ gerekli: künye sayfası (kitabın 2. sayfası)
        // tarih, yıl ve basım bilgisini bunlardan alıyor — bkz. drawKunye.
        const simdi = new Date();
        const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const tarihMetni = `${simdi.getDate()} ${aylar[simdi.getMonth()]} ${simdi.getFullYear()}`;

        // --- İç Kapak: kapağın arka yüzü, bilinçli olarak BOŞ ---
        // Gerçek kitap düzeni (2026-08-05 isteği): 1. sayfa kapak, 2. sayfa
        // kapağın iç yüzü (boş), 3. sayfa kitabın başlangıcı; sonda da arka
        // kapağın iç yüzü boş kalır. Bu iki boş sayfaya üstbilgi/sayfa numarası
        // BASILMAZ — aşağıdaki numaralandırma döngüsü onları atlar.
        doc.addPage();
        const onIcKapakIndex = doc.bufferedPageRange().count - 1;

        // --- İçindekiler (Kırmızı Büyük İÇİNDEKİLER ve Tarihsiz Sade Liste) ---
        doc.addPage();
        // Basılı sayfa numaralandırması buradan (İÇİNDEKİLER = 1) başlar.
        const NUMARA_OFSETI = doc.bufferedPageRange().count - 1 - 1;
        // Flipbook'un sayfayaGit() fonksiyonu 1 TABANLI FİZİKSEL sayfa bekliyor,
        // İçindekiler'de ise BASILI numara yazıyor. Dönüşüm sabiti veriyle
        // birlikte dışa verilir ki kapak yapısı değişince flipbook'ta elle
        // düzeltme gerekmesin: fiziksel = basılı + pageOffset.
        author.pageOffset = NUMARA_OFSETI + 1;
        doc.font(fonts.headingBold).fontSize(20).fillColor('#c0392b').text('İÇİNDEKİLER', margins.left, margins.top);
        doc.moveDown(1);
        
        const textWidth = doc.page.width - margins.left - margins.right;
        
        author.articles.forEach((art, idx) => {
            const pageNo = art.page || 3;
            const itemText = `${idx + 1}. ${art.title}`;
            
            // Başlık yüksekliğini önceden hesapla
            doc.font(fonts.heading).fontSize(10.5);
            const titleHeight = doc.heightOfString(itemText, { width: textWidth - 45 });
            
            // Sayfa alt sınırını kontrol et (Önceden temiz sayfa geçişi yap)
            const bottomMarginLimit = doc.page.height - margins.bottom - 25;
            if (doc.y + titleHeight > bottomMarginLimit) {
                doc.addPage();
                doc.y = margins.top;
            }
            
            const startY = doc.y;
            
            // Sol Taraf: Başlık
            doc.font(fonts.heading).fontSize(10.5).fillColor('#2c3e50')
               .text(itemText, margins.left, startY, { width: textWidth - 45 });
            
            // Sağ Taraf: Sayfa Numarası (Aynı hizada)
            doc.font(fonts.semiBold).fontSize(10.5).fillColor('#c0392b')
               .text(String(pageNo), margins.left, startY, { align: 'right', width: textWidth });
            
            // Bir sonraki eleman için Y pozisyonunu düzenle
            doc.y = startY + titleHeight + 4.5;
        });

        // --- Makaleler ---
        doc.addPage(); // İlk makale için sayfa ekle

        author.articles.forEach((art, index) => {
            if (index > 0) {
                const spaceNeeded = 300;
                const remainingSpace = doc.page.height - margins.bottom - doc.y;
                if (remainingSpace < spaceNeeded) {
                    doc.addPage();
                } else {
                    // Selçuklu Motifli Vektörel Ayırıcı Çizgi (Natif PDF Vektör Çizimi)
                    // Boşluklar 2026-08-05'te kullanıcı isteğiyle birer satır
                    // (≈15pt = fontSize 11 + lineGap 3.75) artırıldı: biten
                    // yazı ile çizgi arası 12→27, çizgi ile yeni yazı arası
                    // 18→33.
                    const dividerY = doc.y + 27;
                    const centerX = margins.left + textWidth / 2;
                    
                    doc.save();
                    // Sol ve Sağ İnce Kırmızı Çizgiler
                    doc.moveTo(centerX - 80, dividerY).lineTo(centerX - 18, dividerY).lineWidth(1).strokeColor('#c0392b').stroke();
                    doc.moveTo(centerX + 18, dividerY).lineTo(centerX + 80, dividerY).lineWidth(1).strokeColor('#c0392b').stroke();
                    
                    // Altın Noktalar
                    doc.circle(centerX - 30, dividerY, 1.8).fill('#ffc107');
                    doc.circle(centerX + 30, dividerY, 1.8).fill('#ffc107');
                    
                    // Merkez Selçuklu Baklava Motifi (Kırmızı Dolgu + Altın Çerçeve)
                    doc.save();
                    doc.translate(centerX, dividerY);
                    doc.rotate(45);
                    doc.rect(-4.5, -4.5, 9, 9).lineWidth(1.2).fillAndStroke('#c0392b', '#ffc107');
                    doc.restore();
                    doc.restore();

                    doc.y = dividerY + 33;
                }
            }

            // Bu makalenin GERÇEK başlangıç sayfası burada kaydedilir. İçindekiler
            // numaraları eskiden ayrı bir simülasyonla (calculateArticleStartPages)
            // tahmin ediliyordu ve dizgiyle uyuşmuyordu — 2026-08-05'te ölçülen
            // gerçek değere geçildi (bkz. main(): iki geçişli üretim).
            if (olcum) olcum[index] = doc.bufferedPageRange().count - 1 - NUMARA_OFSETI;

            // Bölüm Başlığı (KIRMIZI RENKLİ KONU BAŞLIĞI)
            doc.font(fonts.headingBold).fontSize(18).fillColor('#c0392b').text(art.title, { align: 'left', width: doc.page.width - margins.left - margins.right });
            // Başlığın altındaki tarih satırı 2026-08-06'da kullanıcı isteğiyle
            // kaldırıldı (kaynak sitedeki bazı tarihler yanlıştı). `art.date`
            // veride DURUYOR — yönetim panelinde ve düzenleme ekranında hâlâ
            // kullanılıyor, sadece basılı sayfada gösterilmiyor. Ölçüm yapan
            // üç yer (calculateArticleGap, calculateArticleStartPages ve
            // buradaki dizgi) tarihsiz olarak BİRLİKTE güncellendi.
            doc.moveDown(1);
            
            // Metin formatlama ve temizlik (DÜZ PARAGRAF GİRİŞİ, İNDENT YOK)
            const rawContent = art.content.replace(/\r/g, '');
            const paragraphs = rawContent.split(/\n\s*\n/).filter(p => p.trim().length > 0);
            
            paragraphs.forEach(p => {
                const pText = p.trim();
                const pHeight = doc.heightOfString(pText, {
                    width: doc.page.width - margins.left - margins.right,
                    lineGap: 3.3
                });
                const remainingSpace = doc.page.height - margins.bottom - doc.y;

                if (pHeight > remainingSpace) {
                    const lineSpacing = 11 + 3.3; // satır aralığı %50 artırıldı
                    const linesThatFit = Math.floor(remainingSpace / lineSpacing);
                    const totalLines = Math.round(pHeight / lineSpacing);
                    const linesOnNextPage = totalLines - linesThatFit;

                    if (linesThatFit < 3 || linesOnNextPage < 3 || remainingSpace < 55) {
                        doc.addPage();
                    }
                }

                // Paragraf düz başlayacak (indent: 0)
                doc.font(fonts.regular)
                   .fontSize(11)
                   .fillColor('#111827')
                   .text(pText, {
                       align: 'justify',
                       lineGap: 3.75, // satır aralığı %50 artırıldı
                       indent: 0, // Düz paragraf girişi
                       paragraphGap: PARAGRAF_ARASI
                   });
            });
        });

        // --- Arka İç Kapak (BOŞ) + Arka Kapak (tam sayfa görsel) ---
        // 2026-08-05'te eklendi. Görsel yoksa sessizce atlanır ki eski
        // kurulumlarda üretim kırılmasın.
        //
        // ÖNEMLİ — arka kapak son YAPRAĞIN ARKA yüzü olmalı: flipbook yaprak y'yi
        // (2y+1 | 2y+2) diye eşliyor ve kitap kapanınca son yaprağın arka yüzünü
        // tek başına solda gösteriyor. Bu yüzden TOPLAM SAYFA SAYISI ÇİFT olmalı.
        // Tek sayıda kalırsa arka kapak bir boş sayfayla yan yana eşleşiyor ve
        // üstüne fazladan bir boş yaprak daha çevriliyordu. İçerik tek numaralı
        // sayfada bittiyse bir yerine İKİ boş sayfa konur (2026-08-05 isteği).
        const atlanan = new Set([0, onIcKapakIndex]);
        let arkaKapakIndex = -1;
        if (fs.existsSync(ARKA_KAPAK)) {
            const icerikSonu = doc.bufferedPageRange().count;   // dolu sayfa sayısı
            const bosAdet = (icerikSonu % 2 === 0) ? 1 : 2;
            for (let b = 0; b < bosAdet; b++) {
                doc.addPage();
                atlanan.add(doc.bufferedPageRange().count - 1);
            }
            doc.addPage();
            arkaKapakIndex = doc.bufferedPageRange().count - 1;
            atlanan.add(arkaKapakIndex);
            doc.image(ARKA_KAPAK, 0, 0, { width: doc.page.width, height: doc.page.height });
        }

        // --- Sayfa Numaraları ve Header Ekleme ---
        // Kapak, iç kapak(lar) ve arka kapak numaralandırmanın dışındadır.
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
            doc.switchToPage(i);

            if (!atlanan.has(i)) {
                const oldTop = doc.page.margins.top;
                const oldBottom = doc.page.margins.bottom;
                doc.page.margins.top = 0;
                doc.page.margins.bottom = 0;

                // Header (Sol: ÖZKURBİR YAYINLARI, Sağ: Yazar Adı - MEKTEP YAZILARI)
                doc.font(fonts.semiBold).fontSize(9).fillColor(COLORS.gri);
                
                doc.text('ÖZKURBİR YAYINLARI', margins.left, 10 * MM_TO_PT, { align: 'left' });
                
                doc.text(author.name + ' - MEKTEP YAZILARI', margins.left, 10 * MM_TO_PT, {
                    align: 'right',
                    width: doc.page.width - margins.left - margins.right
                });
                
                // İnce Çizgi
                doc.moveTo(margins.left, 16 * MM_TO_PT)
                   .lineTo(doc.page.width - margins.right, 16 * MM_TO_PT)
                   .lineWidth(0.5)
                   .strokeColor(COLORS.acikGri)
                   .stroke();
                
                // Footer (Ortalanmış Sayfa No) — İÇİNDEKİLER sayfası 1'dir
                doc.font(fonts.semiBold).fontSize(10).fillColor(COLORS.gri)
                   .text(String(i - NUMARA_OFSETI), margins.left, doc.page.height - margins.bottom + 10, {
                       align: 'center',
                       width: doc.page.width - margins.left - margins.right
                   });

                // Restore margins
                doc.page.margins.top = oldTop;
                doc.page.margins.bottom = oldBottom;
            }
        }
        // --- Künye (2. sayfa) ---
        // Bilinçli olarak EN SONDA çizilir: böylece künyedeki sayfa sayısı
        // tahmin değil, dizilmiş kitabın gerçek son sayfa numarası olur.
        let icerikSonIndex = 0;
        for (let i = 0; i < range.count; i++) if (!atlanan.has(i)) icerikSonIndex = i;
        doc.switchToPage(onIcKapakIndex);
        drawKunye(doc, author, fonts, margins, {
            sayfaSayisi: icerikSonIndex - NUMARA_OFSETI,
            tarih: tarihMetni,
            yil: simdi.getFullYear(),
            // Basım bilgisi PDF'in üretildiği andaki ay/yıl olarak otomatik
            // yazılır (2026-08-05 isteği) — elle güncellenmesi gerekmez.
            basim: `${AYLAR_TR[simdi.getMonth()]} ${simdi.getFullYear()}`
        });

        author.pageCount = doc.bufferedPageRange().count;
        doc.end();
    });
}

function createAuthorWord(author) {
    let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${author.name}</title>
    <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; }
        h1 { font-size: 24pt; text-align: center; color: #1E4E79; page-break-after: always; margin-bottom: 24pt; }
        h2 { font-size: 16pt; color: #3B82F6; margin-top: 24pt; page-break-before: always; border-bottom: 1px solid #1E4E79; padding-bottom: 5px; }
        /* margin-bottom: paragraflar arası bir satır boşluk — PDF'teki
           PARAGRAF_ARASI ile aynı niyet (2026-08-06). */
        p { text-align: justify; text-indent: 24pt; line-height: 2.25; margin: 0 0 14pt; }
    </style>
    </head><body>`;
    
    html += `<h1>${author.name}<br><br><span style="font-size:16pt;color:#666;">Seçme Yazılar</span></h1>`;
    
    author.articles.forEach(art => {
        html += `<h2>${art.title}</h2>`;
        const rawContent = art.content.replace(/\\r/g, '');
        const paragraphs = rawContent.split('\\n').filter(p => p.replace(/[\\s\\u200B-\\u200D\\uFEFF\\u00A0]+/g, '').length > 0);
        paragraphs.forEach(p => {
            html += `<p>${p.trim()}</p>`;
        });
    });
    
    html += `</body></html>`;
    return Buffer.from(html, 'utf8');
}

function expandAuthorsByVolume(authorsList) {
    const expanded = [];
    // build_library.js ile BİREBİR aynı olmalı — kitap bölme eşiği artık yazı
    // sayısına göre (sayfa sayısı yazıdan yazıya değişebildiği için değil).
    const MAX_ARTICLES_PER_BOOK = 40;

    authorsList.forEach(author => {
        if (!author.articles || author.articles.length === 0) {
            expanded.push(author);
            return;
        }

        const totalArticles = author.articles.length;
        if (totalArticles <= MAX_ARTICLES_PER_BOOK) {
            expanded.push({ ...author, rawAuthorName: author.name, volumeIndex: 1, totalVolumes: 1, volumeComplete: true });
        } else {
            const volumeCount = Math.ceil(totalArticles / MAX_ARTICLES_PER_BOOK);
            for (let v = 0; v < volumeCount; v++) {
                const startIdx = v * MAX_ARTICLES_PER_BOOK;
                const endIdx = Math.min(startIdx + MAX_ARTICLES_PER_BOOK, totalArticles);
                const volumeArticles = author.articles.slice(startIdx, endIdx);

                // İsim üzerinde cilt numarası yazılmaz (kapağa basılmaz) — kimlik
                // ayrımı sadece dosya adında (_KITAPn eki) yapılır, bkz. safeName.
                expanded.push({
                    ...author,
                    rawAuthorName: author.name,
                    volumeIndex: v + 1,
                    totalVolumes: volumeCount,
                    volumeComplete: volumeArticles.length >= MAX_ARTICLES_PER_BOOK,
                    articles: volumeArticles
                });
            }
        }
    });

    return expanded;
}

/* TEK-YAZAR MODU (2026-08-08 eklendi)
   Kullanım: node generate_pdf_kit.js "MEHMET KUTLU"
   Argüman verilmezse eskisi gibi TÜM yazarlar üretilir.

   NEDEN: 59 yazarın hepsini üretmek bu makinede ~41 saniye sürüyor; Render'ın
   ücretsiz planında (0.1 CPU) bu birkaç dakikaya çıkıp isteği zaman aşımına
   uğratıyor. Oysa bir yazı onaylandığında sadece O yazarın kitapçığı değişiyor.
   Diğer yazarların sayfa numaraları veritabanında zaten duruyor ve aşağıdaki
   toplu yazma (rawAuthors) onları koruduğu için filtrelemek güvenli. */
const SADECE_YAZAR = (process.argv[2] || '').trim();

/* PDF üstverisine gömülen sabit tarih (bkz. aşağıdaki CreationDate açıklaması).
   Değeri önemsiz, SABİT olması önemli. */
const SABIT_TARIH = new Date('2026-01-01T00:00:00Z');
const yazarAdiEsit = (a, b) =>
    (a || '').trim().toLocaleUpperCase('tr') === (b || '').trim().toLocaleUpperCase('tr');

async function main() {
    console.log(SADECE_YAZAR
        ? `PDFKit ile E-Kitapçık Üretiliyor (yalnızca: ${SADECE_YAZAR})...`
        : "PDFKit ile E-Kitapçıklar Üretiliyor...");
    
    let rawAuthors = [];
    try {
        const rawData = fs.readFileSync('veritabani/yazarlar_veritabani.json', 'utf8');
        rawAuthors = JSON.parse(rawData);
    } catch(e) {
        console.error("Hata: yazarlar_veritabani.json bulunamadı.");
        return;
    }

    // Makale başlıkları kalıcı olarak büyük harfe çevrilir — PDF, İçindekiler,
    // Word çıktısı, flipbook TOC paneli ve yönetici panelindeki makale listesi
    // AYNI kaynak veriyi kullandığı için burada TEK SEFERDE yapmak yeterli.
    rawAuthors.forEach(a => (a.articles || []).forEach(art => {
        if (art.title) art.title = art.title.toLocaleUpperCase('tr');
    }));

    const authors = expandAuthorsByVolume(rawAuthors);

    if (!fs.existsSync('flipbook/data')) {
        fs.mkdirSync('flipbook/data', { recursive: true });
    }
    if (!fs.existsSync('pdf_ciktilari')) {
        fs.mkdirSync('pdf_ciktilari', { recursive: true });
    }

    const KITAP_ESIGI = 1;
    const hepsi = {};
    const hepsiDoc = {};

    let uretilenSayisi = 0;
    for (let i = 0; i < authors.length; i++) {
        const yazar = authors[i];
        if (!yazar.articles || yazar.articles.length < KITAP_ESIGI) continue;
        // Tek-yazar modunda diğerlerini atla. Ad karşılaştırması cilt farkını
        // gözetmez; bir yazarın tüm ciltleri birlikte yeniden üretilir.
        if (SADECE_YAZAR && !yazarAdiEsit(yazar.name, SADECE_YAZAR)) continue;

        // Pre-calculate page numbers
        const margins = {
            top: 30 * MM_TO_PT,
            bottom: 20 * MM_TO_PT,
            left: 20 * MM_TO_PT,
            right: 20 * MM_TO_PT
        };
        const fonts = {
            regular: fs.existsSync('Roboto-Regular.ttf') ? 'Roboto-Regular.ttf' : 'Helvetica',
            semiBold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            bold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            heading: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold',
            headingBold: fs.existsSync('Roboto-Bold.ttf') ? 'Roboto-Bold.ttf' : 'Helvetica-Bold'
        };
        // İlk tahmin (kaba simülasyon) — sadece 1. geçişin İçindekiler'ini
        // doldurmak için. Gerçek numaralar aşağıdaki ölçümle geliyor.
        const startPages = calculateArticleStartPages(yazar, margins, fonts, COLORS);
        yazar.articles.forEach((art, idx) => {
            art.page = startPages[idx];
        });

        console.log(`PDF & Word Üretiliyor: ${yazar.name} (${yazar.articles.length} yazı)`);

        // İKİ GEÇİŞLİ ÜRETİM: İçindekiler'deki sayfa numaraları eskiden ayrı bir
        // simülasyonla tahmin ediliyordu ve gerçek dizgiyle uyuşmuyordu (erken
        // makalelerde 2, sonlarda 1 sayfa sapıyordu). Artık 1. geçişte gerçek
        // sayfalar ÖLÇÜLÜP art.page'e yazılıyor, 2. geçişte İçindekiler bu doğru
        // numaralarla basılıyor. Sayfa numarası başlık yüksekliğini etkilemediği
        // için (ayrı, sağa hizalı çiziliyor) düzen iki geçiş arasında değişmez —
        // yine de doğrulanıp gerekirse bir tur daha dönülüyor.
        let pdfBuffer, olcum = [];
        for (let gecis = 1; gecis <= 3; gecis++) {
            const yeni = [];
            pdfBuffer = await createAuthorPDF(yazar, '', yeni);
            const oturdu = yeni.every((v, i) => v === yazar.articles[i].page);
            yazar.articles.forEach((art, idx) => { art.page = yeni[idx]; });
            olcum = yeni;
            if (oturdu) break;
            if (gecis === 3) {
                console.warn(`  ! ${yazar.name}: İçindekiler sayfa numaraları 3 geçişte oturmadı.`);
            }
        }
        const docBuffer = createAuthorWord(yazar);
        
        const b64 = pdfBuffer.toString('base64');
        const docB64 = docBuffer.toString('base64');
        // build_library.js'teki kart ID üretimiyle BİREBİR aynı olmalı
        // (flipbook, kart tıklandığında bu ID ile data/ dosyasını arıyor).
        const idEki = (yazar.volumeIndex || 1) > 1 ? `_KITAP${yazar.volumeIndex}` : '';
        const safeName = (yazar.name.replace(/[^a-zA-Z0-9]/g, '_') + idEki).toUpperCase();
        
        // Save Base64 JS for Flipbook
        const articlesJson = JSON.stringify(yazar.articles);
        const jsIcerik = `window.AUTHOR_PDFS = window.AUTHOR_PDFS || {};\nwindow.AUTHOR_PDFS["${safeName}"] = "${b64}";\nwindow.AUTHOR_DOCS = window.AUTHOR_DOCS || {};\nwindow.AUTHOR_DOCS["${safeName}"] = "${docB64}";\nwindow.AUTHOR_ARTICLES = window.AUTHOR_ARTICLES || {};\nwindow.AUTHOR_ARTICLES["${safeName}"] = ${articlesJson};\nwindow.AUTHOR_PAGE_OFFSET = window.AUTHOR_PAGE_OFFSET || {};\nwindow.AUTHOR_PAGE_OFFSET["${safeName}"] = ${yazar.pageOffset || 2};`;
        const outputPath = `flipbook/data/${safeName}.js`;
        fs.writeFileSync(outputPath, jsIcerik);

        // Save raw .pdf file to web sayfası/pdf_ciktilari/
        const pdfPath = `pdf_ciktilari/${safeName}.pdf`;
        fs.writeFileSync(pdfPath, pdfBuffer);
        
        console.log(` > ${safeName}.js & ${safeName}.pdf oluşturuldu.`);
        
        hepsi[safeName] = b64;
        hepsiDoc[safeName] = docB64;
        uretilenSayisi++;
    }

    // Save updated authors database back with page numbers.
    // ÖNEMLİ: bölünmüş `authors` (cilt/kitap parçalanmış) DEĞİL, orijinal
    // `rawAuthors` yazılır — aksi halde her çalıştırmada kalıcı olarak aynı
    // yazar birden fazla kayda bölünür (bkz. Hacer Elbey (Cilt 2) hatası).
    // Sayfa numaraları zaten aynı makale nesneleri referans paylaşıldığı için
    // rawAuthors üzerinde de güncel.
    fs.writeFileSync('veritabani/yazarlar_veritabani.json', JSON.stringify(rawAuthors, null, 2), 'utf8');
    console.log("✓ yazarlar_veritabani.json sayfa numaralarıyla güncellendi.");

    console.log(`\n🎉 Toplam ${uretilenSayisi} yazarın e-kitapçık PDF dosyaları başarıyla üretildi!`);
}

main();

