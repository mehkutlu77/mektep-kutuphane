# SESSION STATE - 30. PROGRAM Mektep Yazar Kitapçıkları
Last Updated: 2026-08-07 (onuncu oturum — Canlı İnternet Sunucusu Uyumlu Temizlik ve Lokal Komut Arındırması Yapıldı)

## Current Task — 2026-08-07, onuncu oturum (TAMAMLANDI)
1. **Şifre İpuçlarının Temizlenmesi:** Giriş hatasında ekranda görünen parantez içindeki varsayılan şifre metinleri kaldırıldı, standart güvenlikli uyarı mesajlarına (`Hatalı yönetici kullanıcı adı veya şifre!`) geçildi.
2. **Yönetici Kimliği Güncellendi:** Yeni varsayılan yönetici kimliği `erdem.ozkur` / `erdem.123` olarak tanımlandı.
3. **Kalıcı Yönetici Hesabı (`admin_hesap.json`):** Sunucu tarafında yönetici bilgilerini tutan `admin_hesap.json` yapılandırma dosyası oluşturuldu.
4. **Canlı Yönetici Şifre Değiştirme Modülü (`/api/change-admin-password`):** Yönetim paneline (`mektep_yonetim.html`) **`🔑 Şifre Değiştir`** butonu ve açılır modal eklendi. Yönetici mevcut şifresini ve yeni kullanıcı adı/şifresini anında güncelleyebilir.
5. **Flipbook Başlık Güncellemesi (`web sayfası/flipbook/index.html`):** `ÖZKURBİR AES'26 KATALOĞU` başlığı kaldırılıp kütüphane konseptine uygun olarak **`Mektep Kütüphanesi — E-Kitapçık Okuyucu`** olarak güncellendi.
6. **Okur ve Okul Sayfaları Yetki İzolasyonu (`web sayfası/flipbook/index.html`):** Okuyucularda (giriş yapmamış veya okul/ziyaretçi sayfalarında) `Düzenle` butonu ve sağ düzenleme paneli tamamen gizlendi. PDF ve Word indirme butonları gizlendi (`display:none`). **Paylaşım butonu okurlar için tam aktif tutuldu** (yazı/kitap linkini paylaşabilirler).
7. **Yazar Unvan / Ön Sıfat Birleştirme Otomasyonu (`build_library.js`, `scrape.js`, `yazarlar_veritabani.json`):** "İSMAİL GÜLER" ve "DR. İSMAİL GÜLER" gibi aynı kişinin unvansız ve unvanlı kaydı otomatik tespit edilip son edindiği unvanlı ismi altında ("DR. İSMAİL GÜLER", 6 yazı) birleştirildi. Tüm derleme ve tarama betiklerine unvan öncelikli birleştirici eklendi.
8. **Canlı İnternet Sunucusu Uyumlu Temizlik (Lokal Komut Arındırması):** Web kodu içerisindeki tüm `Windows_Baslat.bat`, `Mac_Baslat.command`, `http://localhost:3000`, `node server.js` ve terminal komut metinleri temizlendi. İnternet ortamında kullanıcıya doğrudan canlı web uyumlu profesyonel hata ve uyarı mesajları gösterilmesi sağlandı.

## Current Task — 2026-08-06, sekizinci oturum (TAMAMLANDI)
Altı iş yapıldı, hepsi doğrulandı: (1) yazı başlıklarının altındaki **tarih
satırı kaldırıldı** (`generate_pdf_kit.js`), (2) **kırmızı daire ÖZKURBİR
logosu** kütüphane başlığından kaldırıldı (`build_library.js`), (3) kitap
kapağına gelince çıkan **"↗ Yeni sekmede"** düğmesi eklendi ve flipbook artık
kitabı adres satırından (`?kitap=`) okuyor, (4) yönetici paneline **elle yazı
ekleme** (`POST /api/add-article`) ve **"bir yazarda aynı başlıktan tek kayıt"**
kuralı geldi, (5) **sesli okuma baştan yazıldı** — artık açık PDF sayfasının
kendi metnini okuyor, duraklat/devam ve durdur düğmeleri var, (6) flipbook'un
**ahşap zemini** açık meşe dokusuyla değiştirildi.

## ÖNEMLİ: Kütüphaneyi AÇMA YÖNTEMİ — HTML'e çift tıklama YOK
Kütüphane **`Mac_Baslat.command` dosyasına çift tıklanarak** açılır (Windows'ta
`Windows_Baslat.bat`). Bu, `node server.js`'i başlatır ve tarayıcıyı
`http://localhost:3000/login.html` adresine götürür.
**`web sayfası/` içindeki HTML dosyalarına Finder'dan çift tıklanmamalıdır** —
o şekilde açıldığında sayfa `dosya://` adresinden gelir, tarayıcı hiçbir
sunucuya istek atamaz ve "Webden Canlı Güncelle" gibi sunucu gerektiren
özellikler çalışmaz (sayfa görsel olarak normal göründüğü için bu durum
2026-08-06 oturumunda uzun süre yanıltıcı oldu). Salt okuma amaçlı statik
kullanım (8133 önizlemesi veya bir hosting) yine çalışır; sadece `/api/*`
gerektiren işlemler devre dışı kalır.

## ÖNEMLİ: "web sayfası/" klasörü artık ana çalışma alanı
Kök klasördeki dosyalar (scrape.js, node_modules, PDFKit fontları,
yazarlar_veritabani.json, package.json vb.) sadece DERLEME/kaynak amaçlı —
web sayfası çalışırken hiçbiri kullanılmıyor. Kullanıcı isteğiyle bundan
sonraki oturumlarda önce `web sayfası/` içine odaklanılacak, kök klasöre
sadece ham veri (yazarlar_veritabani.json) veya build script'lerine
(generate_pdf_kit.js, build_library.js) ihtiyaç olduğunda gidilecek.

## ÖNEMLİ: Yazar kullanıcı adları — "İ" tuzağı ve giriş yedek akışı (2026-08-06)
Yazar girişinde kitabın görünmemesinin İKİ ayrı sebebi vardı, ikisi de kapandı.

**1) `nameToUsername()` bozuk kullanıcı adı üretiyordu.** Fonksiyon önce
`name.toLowerCase()` çağırıp SONRA Türkçe harf haritasını uyguluyordu.
JavaScript'in yerel-duyarsız `toLowerCase`'i **"İ" → "i + U+0307 (birleşen
nokta)"** üretir; nokta haritada olmadığı için hayatta kalır ve son satırdaki
`[^a-z0-9] → '.'` onu NOKTAYA çevirirdi. **62 yazarın 16'sı etkilendi**
(`EMİN KEVEN` → `emi.n.keven`, `İBRAHİM İNAL` → `i.brahi.m.i.nal`, …).
İ kelime SONUNDAysa nokta bir sonrakiyle birleşip görünmez oluyordu — bu yüzden
`ALİ DAYIOĞLU` → `ali.dayioglu` sağlam çıkmış ve sorun ancak bazı yazarlarda
fark edilmişti. **Çözüm:** harita ÖNCE (özgün harfler üzerinde), sonra küçültme,
artakalan birleşen işaretler NFD ile ayıklanıyor. `dbKullaniciGuncelle()` artık
sunucu açılışında bozukları OTOMATİK onarıyor; onarım ölçütü "tek harflik parça"
imzası — yöneticinin elle verdiği özel kullanıcı adları bu testten geçmez, yani
onlara dokunulmaz. Çakışma kontrolü var.
**Bu, `basligiNormalize()`'daki U+0307 tuzağının AYNISI** — Türkçe metinde
`toLowerCase`/`toUpperCase` kullanan yeni kod yazarken bunu hatırla.

**2) SESSİZ HATA: yanlış kullanıcı adı giriş yapabiliyordu.** `login.html`'in
çevrimdışı yedek akışı yazar girişinde kullanıcı adına HİÇ bakmıyor, sadece
şifre `mektep123`/`admin123` mi diye soruyordu — üstelik sunucu isteği
REDDETTİĞİNDE de çalışıyordu. Var olmayan bir kullanıcı adı (örn. gerçek adı
`doc.dr.erdal.kilic` olan yazar için `erdal.kılıç`) "başarıyla" giriş yapıyor,
`authorRealName` o uydurma ada ayarlanıyor ve kütüphane hiçbir kartla
eşleşemediği için **bomboş raf** gösteriyordu; hata bile vermiyordu.
**Çözüm:** (a) `sunucuKarar` bayrağı — sunucuya ulaşıldıysa onun "hayır"ı
kesindir, yedek akış devreye girmez; (b) çevrimdışı modda kullanıcı adı,
build_library.js'in ürettiği **`web sayfası/yazar_kullanicilari.js`** listesinden
doğrulanır (yalnız kullanıcı adı + görünen ad + kart kimliği; **ŞİFRE YOK**);
(c) hata mesajı ayrıştırıldı ve en yakın kullanıcı adını öneriyor;
(d) kütüphane, yazar girişinde hiç kart eşleşmezse sessiz boş raf yerine sebebi
açıklayan bir kutu gösteriyor (kullanıcı adı tanınmadı / henüz yazınız yok).

**Yeni üretilen dosya:** `web sayfası/yazar_kullanicilari.js` — `build_library.js`
üretir, `login.html` `<script src>` ile yükler. Elle düzenlenmez.

## ÖNEMLİ: Bir yazarda AYNI BAŞLIKTAN TEK KAYIT (2026-08-06)
Kullanıcı kuralı. Üç yerde birden uygulanıyor: `scrape.js` (tarama),
`server.js` → `/api/add-article` (elle giriş) ve `/api/save-articles`
(tam kitap düzenleyici). Karşılaştırma anahtarı `basligiNormalize()` ile
üretiliyor; **`server.js` ve `scrape.js`'teki iki kopya BİREBİR AYNI olmalı**
(program ile kontrol edildi). Anahtar: tırnak çeşitleri (`'’"“”«»`) tek biçime
indirgenir → NFD ile aksanlar atılır → büyük harf → boşluklar sadeleşir.
Aksanların atılması şart: "LİYAKAT" küçük harfe çevrilip tekrar büyütüldüğünde
başıboş bir birleşen nokta (U+0307) kalıyor ve naif karşılaştırma eşleşmiyordu.
**Yinelenmenin kök sebebi:** `scrape.js` yalnızca URL'e bakıyordu; site aynı
yazıyı büyük/küçük harfi farklı iki adreste sunduğunda ikinci kez ekliyordu.
Veritabanında EMİN KEVEN'de böyle bir çift vardı (aynı başlık, aynı tarih,
**birebir aynı 7962 karakter**, sadece URL'de iki harf farklı) — temizlendi,
473 → **472 makale**. Yedek: `yazarlar_veritabani_yedek_2026-08-06_yinelenen_temizligi.json`.

## ÖNEMLİ: Yönetici panelinden ELLE YAZI EKLEME (2026-08-06)
Site taraması bazen yeni yazıyı getirmiyor; iki yol da açık. Panelin üstünde
"✍️ Elle Yazı Ekle" düğmesi → yazar seç + başlık + metin → yazı o yazarın
listesinin **sonuna** eklenir ve PDF/flipbook hemen yeniden üretilir.
- Uç: `POST /api/add-article` (`server.js`). `yoneticiMi()` ile yetki,
  `yaziEkleniyor` kilidi (tarama ile aynı anda çalışamaz, ikisi de aynı JSON'a
  yazıyor), 400/403/404/409 hata yolları.
- Aynı başlık varsa **409 + `yinelenen:true`** döner, ikinci kayıt AÇILMAZ;
  panel "mevcut yazının metni güncellensin mi?" diye sorar, onaylanırsa istek
  `uzerineYaz:true` ile tekrarlanır.
- Elle girilen kayıt `url: 'elle-girildi://...'` ve `elleGirildi:true` taşır —
  `scrape.js`'in URL'e bakan kontrolü bunu asla eşleştirmesin diye.
- Paragraflar **boş satırla** ayrılır (form ipucunda yazıyor).

## ÖNEMLİ: SESLİ OKUMA artık AÇIK SAYFANIN METNİNİ okur (2026-08-06)
**Eski hata:** metin veritabanından alınıyor, sayfa numarasına en yakın
MAKALE bulunup TAMAMI baştan okunuyordu — bir yazının 2. sayfasındayken ses
yazının başına dönüyordu. **Yeni:** metin pdf.js `getTextContent()` ile
EKRANDAKİ PDF SAYFASINDAN çıkarılıyor.
- Masaüstünde açık kitapta önce SOL sonra SAĞ sayfa; telefonda görünen tek sayfa.
- Sayfa üstündeki başlık ve alttaki numara **konuma göre** eleniyor
  (y > yükseklik-55 üst bilgi, y < 45 alt bilgi) — yoksa her sayfa başında
  "ÖZKURBİR YAYINLARI ... MEKTEP YAZILARI" okunurdu.
- Metin cümlelere bölünüp sırayla seslendiriliyor: Chrome uzun tek utterance'ı
  ~15 sn sonra kesiyor, ayrıca duraklat/devam cümle sınırında temiz çalışıyor.
- Düğmeler: **Sesli Oku → Duraklat → Devam Et** (aynı düğme, yer korunur) ve
  ayrı **Durdur** (sayacı sıfırlar, tekrar başlatınca AÇIK SAYFANIN BAŞINDAN).
  Durdur düğmesi yalnızca okuma sürerken görünür.
- **`ttsNesil` sayacı:** `speechSynthesis.cancel()` iptal edilen utterance için
  de olay tetikleyebiliyor; geç gelen olay yeni okumanın cümle sayacını
  ilerletip iki cümleyi üst üste bindirebilirdi. Her utterance doğduğu nesli
  hatırlar, nesil değiştiyse olayı yok sayar. **Bu koruma silinmemeli.**
- Sayfa çevrilince okuma durur; ölçüt "sayfa listesi değişti mi" DEĞİL,
  "okunan sayfalardan hiçbiri artık ekranda değil mi" — böylece telefon
  yatay/dikey çevrilince (liste [7] ↔ [6,7] olur) okuma kesilmez.

## ÖNEMLİ: Kitap bölme eşiği artık 40 YAZI (sayfa değil)
`MAX_ARTICLES_PER_BOOK = 40` hem `build_library.js` hem `generate_pdf_kit.js`
içinde (ikisi BİREBİR aynı olmalı). "Kitap N" YAZISI (kapağın ÜZERİNE değil
ALTINA, `.kitap-etiketi` sınıfı) yazarın birden fazla kitabı varsa HER ZAMAN
gösterilir (tamamlanmış olsun olmasın); yeşil ✓ tik işareti ise SADECE o cilt
kendi içinde 40 makaleye ulaştıysa etikete eklenir (`author.volumeComplete`).
**GÜNCELLEME (2026-08-02, beşinci oturum):** Önceki kural ("etiket sadece
tamamlanmışsa görünür") kullanıcı isteğiyle değişti — artık etiket her zaman
görünür, sadece tik koşullu. Tek kitaplı yazarlarda hiç etiket yok. **Ayrıca
tamamlanmamış devam kitabı (Kitap 2, 3...)
GENE DE tam tıklanabilir/okunabilir normal bir kitap kartıdır** — az yazılı
tek-kitaplı bir yazardan (örn. 3 yazısı olan biri) tıklanabilirlik açısından
farkı YOKTUR; tek görsel fark, çok-ciltli yazarda etiketin daima görünüp
tamamlanmadıysa tiksiz kalmasıdır. (İlk denemede bunu yanlışlıkla
soluk/tıklanamaz `.yakinda` kartı yaptım, kullanıcı düzeltti: "ikinci kitabına
giriş yapamıyorum" — bkz. "Son Yapılanlar, üçüncü oturum". `basiliMi` artık
sadece `kitapOldu`'ya eşit, `volumeComplete`'ten bağımsız.) Rozet sistemi
(Gümüş/Altın/Platin, "N Kitap") `pageCount` değil YAZI sayısına göre
hesaplanıyor. Dosya kimlikleri (`_KITAP2` gibi) sadece `safeName`'de
kullanılıyor, görünen isimde YOK — `author.name` her zaman çıplak kalır.

## KRİTİK HATA DÜZELTİLDİ: generate_pdf_kit.js veritabanını bozuyordu
Eskiden dosyanın sonunda bölünmüş (`expandAuthorsByVolume` çıktısı) liste
`yazarlar_veritabani.json`'a geri yazılıyordu — bu, HER PDF üretiminde
TÜM yazarlara `volumeIndex`/`totalVolumes`/`rawAuthorName` gibi türetilmiş
alanları kalıcı olarak bulaştırıyor, üstüne bir de çok-kitaplı yazarları
(o an Hacer Elbey) aynı isimle iki ayrı kayda böl üp kalıcılaştırıyordu —
tam olarak "Cilt 1/Cilt 2" kalıcı-veri hatasının otomatik tekrarı. Artık
orijinal `rawAuthors` yazılıyor (makale nesneleri referans paylaşıldığı için
sayfa numaraları yine de güncel kalıyor). **Eğer ileride yazarlar_veritabani.json
içinde bir yazarda `volumeIndex`/`totalVolumes`/`rawAuthorName` alanı görülürse
veya aynı isim iki kayıtta tekrar ederse, bu hata geri gelmiş demektir — hemen
JSON'u temizleyip generate_pdf_kit.js'in çıktı hedefini kontrol et.**

## Ne bu proje?
mektep.ozkurbir.org yazarlarının yazılarını kitapçıklaştıran sistem.
Boru hattı: `scrape.js` → `yazarlar_veritabani.json` (3 MB, 61 yazar, KÖKTE
kalıyor, kaynak veri) → `build_library.js` + `generate_pdf_kit.js` → çıktı
artık KÖKE değil `web sayfası/` alt klasörüne yazılıyor (bkz. aşağıdaki
"web sayfası" bölümü).

## ÖNEMLİ: web sayfası/ = TESLİM EDİLECEK KLASÖR (deploy bundle)
2026-08-01'de kullanıcı isteğiyle proje ikiye ayrıldı:
- **Kök klasör** = kaynak/araç tarafı: `generate_pdf_kit.js`, `build_library.js`,
  `scrape.js`, `server.js`, `node_modules/`, `yazarlar_veritabani.json`,
  yazı tipi `.ttf` dosyaları (PDFKit sunucu tarafı için), `mektepkapak_eski_*`
  ve `*_orijinal.png` yedekleri, `a-logo.pdf`, dokümantasyon. Bunlar **web
  sayfasına dahil edilmez**, sadece üretim/geliştirme içindir.
- **`web sayfası/`** = kullanıcının başka bir siteye yükleyeceği, KENDİ
  BAŞINA çalışan statik paket: `login.html`, `mektep_kutuphane.html`,
  `mektep_yonetim.html`, `a-logo.png`, `mektepkapak.png`,
  `flipbook/` (index.html, pdf.min.js, pdf.worker.min.js, ahsap_arka_plan.jpg,
  data/*.js — 59 dosya), `pdf_ciktilari/*.pdf` (59 dosya, yönetici panelindeki
  doğrudan indirme linkleri için). Node/sunucu GEREKTİRMEZ — dosya:// veya
  herhangi bir statik host üzerinde çalışır.
- **`generate_pdf_kit.js` ve `build_library.js` artık DOĞRUDAN `web sayfası/`
  içine yazıyor** (satırlar güncellendi: `doc.image('web sayfası/mektepkapak.png'...)`,
  `web sayfası/flipbook/data/`, `web sayfası/pdf_ciktilari/`,
  `web sayfası/mektep_kutuphane.html`, `web sayfası/mektep_yonetim.html`).
  Yani **normal iş akışı değişmedi** — kökte `node generate_pdf_kit.js` /
  `node build_library.js` çalıştırmaya devam et, çıktı otomatik doğru yere
  düşer, elle kopyalamaya GEREK YOK.
- `launch.json`'daki `mektep-kutuphane` sunucusu artık doğrudan
  `web sayfası/` klasörünü serve ediyor (port 8133) — önizleme = teslimat.
- **Kasıtlı olarak web sayfası'na KONMADI:** `yazarlar_veritabani.json`
  (58 yazarın düz metin şifrelerini içeriyor — herkese açık statik sitede
  bulunması güvenlik riski; site zaten `window.AUTHOR_ARTICLES` embedded
  fallback'iyle bu dosya olmadan da çalışıyor, sadece "yazar girişi" canlı-veri
  senkronu ve `/api/*` uçları (save-articles, update-password, login) çalışmaz
  — onlar için gerçek bir Node sunucusu (`server.js`) gerekir, salt statik
  dosya barındırma yetmez). Ayrıca kullanılmayan `flipbook/back5.svg`,
  boş `flipbook/css/`, `flipbook/js/`, eski logo/kapak yedekleri de dahil
  edilmedi.
- Kökte `flipbook/` ve `pdf_ciktilari/` klasörleri hâlâ duruyor ama artık
  BOŞ/yetim (data ve pdf'ler taşındı) — script'ler onları otomatik yeniden
  oluşturmuyor çünkü artık `web sayfası/` altına yazıyorlar; bu iki boş klasör
  silinebilir, zararsız.

## ÖNEMLİ: mektep_kutuphane.html'i ELLE DÜZENLEME
O dosya üretilir — değişiklik `build_library.js`'e yapılıp
`node build_library.js` ile yeniden üretilir (çıktı `web sayfası/` içine gider).

## ÖNEMLİ: web sayfası/kapak.png = GERÇEK KAPAK GÖRSELİ (dosya adı 2026-08-02'de değişti)
Kapak artık programatik çizim değil, tam sayfa görsel. **Dosya adı
`mektepkapak.png` → `kapak.png` olarak değişti** (kullanıcı bu adla yeni bir
dosya sağladı). Hem `generate_pdf_kit.js` (kitabın ilk sayfası, kapak metni
`doc.image('web sayfası/kapak.png', ...)`) hem `build_library.js` (raftaki
kitap kartı, `.book-cover{background-image:url('kapak.png')}`) AYNI bu
dosyayı okuyor — biri değişince ikisi de değişsin isteniyorsa `kapak.png`'in
kendisi değiştirilir, kod dokunulmaz.

**TEKRARLANAN KALİBRASYON İHTİYACI:** Kapak HER değiştiğinde yazar adı/unvan
metinlerinin konumu/boyutu yeniden ayarlanmalı, çünkü metin görselin iki
dekoratif çizgisi ARASINDAKİ boşluğa ortalanıyor ve bu boşluğun piksel
konumu/genişliği görsele göre değişiyor. **Yöntem:** PIL/numpy ile görseldeki
iki çizginin y-piksel konumu ölçülür (merkezden uzak bir x'te, arka plandan
renk sapması taranarak) → piksel→PDF-point (`pt = px * 841.89/1492`) ve
piksel→CSS-% (`% = px/1492*100`) çevrilir → font boyutu boşluğa göre küçültülür/
büyütülür. `generate_pdf_kit.js`'teki kapak metni bloğu (`doc.font(...).text(author.name, ...)`
ve unvan satırı) ile `build_library.js`'teki `.cover-author-overlay` /
`.cover-author-name` / `.cover-author-title` CSS'i BİRLİKTE güncellenir.
2026-08-02'de bu kalibrasyon İKİ KEZ, 2026-08-06'da bir kez daha tekrarlandı.

**GÜNCEL DEĞERLER (2026-08-06 ölçümü — kapak.png artık 1131x1600):**
- Ölçek: `1 px = 841.89/1600 = 0.5262 pt`  (ESKİ kapak 1054x1492 idi, formül
  değişti — kapak ölçüsü değişirse bu bölen de değişir!)
- Üst süsleme çizgisi: 889.5 px → **468.0 pt** → **%55.59**
- Alt süsleme çizgisi: 1034.5 px → **544.3 pt** → **%64.66**
- Aradaki boşluk: 145 px → **76.3 pt** (önceki kapakta 62.6 pt idi, %22 geniş)
- `generate_pdf_kit.js` kapak: SADECE yazar adı, `fontSize 21`, `y=492`
  (align:center) → boşlukta üst 24.0 pt / alt 24.6 pt.
- `generate_pdf_kit.js` künye (2. sayfa): yazar adı `fontSize 19`, `y=300`.
- `build_library.js`: `.cover-author-overlay{top:55.6%; height:9.07%}` +
  flex ile dikey ortalama (sabit `top` DEĞİL — bkz. aşağıdaki not),
  `.cover-author-name{font-size:0.58rem}` (telefonda 0.45rem).

**Neden `height` + flex:** Eskiden sadece `top` veriliyordu; yazar adı iki
satıra sardığında (uzun unvanlı isimler) blok aşağı taşıp alt çizgiye
yaslanıyordu. Artık bandın kendisi (iki çizgi arası) konumlandırılıp içerik
`justify-content:center` ile ortalanıyor — tek satır da olsa iki satır da
olsa boşluğun tam ortasında kalıyor.

Kapak bir daha değişirse bu değerlerin TAMAMI yeniden ölçülmeli.

## ÖNEMLİ: Kapakta ve künyede SADECE yazar adı var — unvan YAZILMAZ
2026-08-06'da kullanıcı uyardı: kapakta yazan "Eğitimci Yazar" ifadesi
herkes için doğru değildi. **Kontrol edildi: veritabanındaki 62 yazarın
HİÇBİRİNDE `title` alanı yok** (0/62), yani `author.title || 'Eğitimci Yazar'`
her seferinde varsayıma düşüyordu. Önce nötr "Yazar" etiketi denendi, sonra
kullanıcı isteğiyle o da kaldırıldı. Şu an dört yerde de yalnızca isim var:
PDF kapağı, künye sayfası, kütüphane kartı, çok ciltli özet kartı.
`author.title` alt yapısı KORUNDU — ileride veritabanına gerçek unvan
eklenirse (örn. "Şair", "Akademisyen") kolayca bağlanabilir.

## ÖNEMLİ: Kapakta tarih satırı YOK
Kapağın en altındaki `ÖZKURBİR YAYINLARI · 6 Ağustos 2026` satırı 2026-08-06'da
kaldırıldı. Yalnızca onun için var olan `doc.page.margins.bottom = 0` hilesi de
silindi (yazı alt marjinin dışına düştüğü için PDFKit'in otomatik sayfa
açmasını engelliyordu). **`simdi` / `tarihMetni` değişkenleri SİLİNMEDİ** —
künye sayfası (`drawKunye`) tarih, yıl ve basım bilgisini onlardan alıyor.

## Son Yapılanlar (2026-08-01, ikinci oturum — Kitap 1/2 görünümü + kritik veri hatası)
- **Kitap etiketi kapağın altına taşındı, sadece tamamlanan kitapta gösteriliyor:**
  Kullanıcı isteği: "Kitap 1"/"Kitap 2" artık kapak görselinin ÜZERİNE değil
  ALTINA yazılıyor (`.kitap-etiketi` CSS sınıfı, `build_library.js`). Devam
  kitabı (2. ve sonrası) sadece kendi içinde eşiği (40 yazı) tamamlarsa
  etiketlenip tıklanabilir oluyor; tamamlanmadıysa aynı yazarın tamamlanmış
  kitabının YANINDA soluk/gri, tıklanamaz bir kart (`.yakinda` sınıfı) olarak
  duruyor, hiç etiket yazmıyor. Kartlar artık yazar bazında gruplanıp
  `volumeIndex` sırasına göre yan yana diziliyor (`createLibraryHTML` içinde
  `gruplar` mantığı) — önceden global yazı-sayısı sıralaması ciltleri
  birbirinden ayırabiliyordu.
- **Kitap bölme eşiği 50 → 40 yazı, VE artık sayfa değil yazı bazlı:**
  Kullanıcı: "Kitaplar sayfa sayısına göre değil yazı sayısına göre
  belirlenecek, her 40 yazı bir kitap." `MAX_ARTICLES_PER_BOOK` hem
  `build_library.js` hem `generate_pdf_kit.js`'te 40 yapıldı (ikisi birebir
  aynı olmalı). Rozet sistemi (Gümüş/Altın/Platin, "N Kitap", `createAdminHTML`
  tablosundaki madalya/kitap sütunu) da `pageCount` yerine yazı sayısına göre
  hesaplanacak şekilde değiştirildi.
- **KRİTİK HATA bulundu ve düzeltildi:** `generate_pdf_kit.js` dosyanın
  sonunda (`main()` içinde) bölünmüş/genişletilmiş `authors` listesini
  (yani `expandAuthorsByVolume()` çıktısını, `volumeIndex`/`totalVolumes`/
  `rawAuthorName` alanları dahil) doğrudan `yazarlar_veritabani.json`'a geri
  yazıyordu. Bu, HER `node generate_pdf_kit.js` çalıştırmasında TÜM yazarlara
  bu türetilmiş alanları kalıcı olarak bulaştırıyor, çok-kitaplı yazarları
  (o an Hacer Elbey) aynı isimle iki ayrı satıra bölüp kalıcılaştırıyordu —
  yani bu oturumun başında düzelttiğimiz "(Cilt 1)/(Cilt 2) kalıcı veri"
  hatasının otomatik olarak kendini yeniden yaratma mekanizmasıydı. Tespit
  şekli: 40'a eşik düşürüldükten sonra JSON'da 61 yazarın TAMAMINDA bu
  alanlar bulundu. Düzeltme: dosya artık orijinal `rawAuthors`'ı yazıyor
  (makale nesneleri referans paylaşıldığı için sayfa numaraları yine de
  güncelleniyor). Kirlenen JSON `python3` ile temizlendi, Hacer Elbey'in
  ikiye bölünmüş kaydı tekrar tek kayıtta (65 yazı) birleştirildi.
- **Hacer Elbey (65 yazı) → Kitap 1 (40, basılı) + devam kartı (25, soluk,
  etiketsiz).** **Hami Koç (44 yazı) → Kitap 1 (40, basılı) + devam kartı
  (4, soluk, etiketsiz).** Diğer tüm yazarlar tek kitap, etiketsiz.
- **Doğrulama:** `node build_library.js` + `node generate_pdf_kit.js` ile
  tüm site yeniden üretildi (59 yazar/kitap çıktısı), tarayıcıda
  (localhost:8133) DOM üzerinden kart yapısı (`.kitap-etiketi`, `.yakinda`,
  `onclick` varlığı/yokluğu) ve flipbook açılışı (Hacer Elbey Kitap 1,
  53→65 sayfa PDF) uçtan uca test edildi. Yetim `_CILT_2_` dosyaları silindi.
- **Yedekler:** `yazarlar_veritabani_yedek_2026-08-01_v2.json` (bu oturumun
  başındaki Hacer Elbey birleştirmesinden önceki hâl).

## DÜZELTME (2026-08-01, üçüncü oturum): devam kitabı tıklanamaz OLMAMALI
Yukarıdaki ikinci oturumda devam kitabını (Kitap 2, tamamlanmamışsa) soluk/
tıklanamaz `.yakinda` kartı yapmıştım — YANLIŞ anlamıştım. Kullanıcı düzeltti:
"ikinci kitabına giriş yapamıyorum ... az sayıda da olsa bu ikinci kitabı da
aynı şekilde görebilmem gerekiyor" — yani 3 yazısı olan tek-kitaplı bir
yazarın kitabı nasıl normal/tıklanabilirse, devam kitabı da (kaç yazısı olursa
olsun) AYNI şekilde normal, tam renkli, tıklanabilir olmalı. Tek fark: altında
"Kitap N" yazısı yalnızca eşik (40) tamamlandıysa görünür — **tıklanabilirlik
bundan bağımsız.** `build_library.js`'te `basiliMi` artık sadece `kitapOldu`
(n >= KITAP_ESIGI), `author.volumeComplete`'e bakmıyor; `.yakinda` sınıfı ve
`onclick` engeli bu kartlara artık uygulanmıyor. `generate_pdf_kit.js` zaten
her cilt için PDF/flipbook verisini koşulsuz üretiyordu, o taraf değişmedi.

**Ek düzeltme (aynı gün, dördüncü tur):** Rozet (Gümüş/Altın/Platin, "N Kitap")
de tamamlanmamış devam kitabında YANLIŞLIKLA görünüyordu (çünkü `toplamYazi`
yazarın TÜM ciltlerinin toplamı, tek başına o cilt tamamlanmasa bile
eşiği geçiyordu). Kullanıcı: "hiçbir kitap oluşmayanlar nasılsa ikinci kitap
o arkadaş için öyle olacak" — yani tamamlanmamış devam kitabının altında
HİÇBİR ŞEY (ne "Kitap N" ne rozet) olmamalı, hiç kitabı olmayan bir yazardan
görsel farkı sıfır olmalı. `badgeHtml` şartına `author.volumeComplete` eklendi
(`build_library.js`) — rozet artık "Kitap N" etiketiyle TAM AYNI şartla
gösteriliyor: sadece bu cilt kendi içinde 40 yazıya ulaştıysa.

## Son Yapılanlar (2026-08-06, dokuzuncu oturum)

### Paragraf araları bir tam satır oldu
`generate_pdf_kit.js` başına `PARAGRAF_ARASI = 11 + 3.75 = 14.75 pt` sabiti
kondu (eski `paragraphGap: 6` yarım satırdan azdı). **Üç yerde birden
kullanılıyor:** dizgi (`paragraphGap`), `calculateArticleGap` ve
`calculateArticleStartPages`. Ayrışırlarsa yetim-başlık koruması ve İçindekiler
numaraları kayar. Word çıktısındaki `p` kuralına da `margin: 0 0 14pt` eklendi.
Ölçüm: paragraf içi satır adımı 18,3 pt, paragraf arası adım 33,0 pt → fark tam
14,75 pt. Kitaplar ~2 sayfa uzadı (HALİL ÖZ 26 → 28).

### Açılışta araç çubuğunun görünmemesi
**Sebep:** sayfa siyah açılıyordu (`rgba(0,0,0,0.8)`), koyu lacivert araç çubuğu
siyah üzerinde ayırt edilemiyordu; 706 KB'lık ahşap görsel yüklenince zemin,
çubuk ve kitap aynı anda "geliyordu". Sekizinci oturumda zemin rengi `#BA8357`
yapılınca bu zaten kapanmıştı — görsel engellenip ilk kare taklit edilerek
doğrulandı, çubuk artık ilk andan itibaren net.
**Ek olarak gerçek bir çakışma bulundu:** 1400 px altındaki pencerelerde çubuk
940 px'e çıkıp sol üstteki `.bilgi-kart`'ın üzerine biniyordu (kartın z-index'i
40, çubuğunki 100 → yazar adının sağı çubuğun altında kalıyordu). Yeni
`araclarCakismaKontrol()` gerçek kutuları ölçüp çakışma varsa `body.araclar-dar`
ile yazıları gizliyor (çubuk ~411 px'e düşüyor). **Sabit kırılma noktası değil**
— önce sınıf kaldırılıp GENİŞ hâl ölçülüyor, yoksa bir kez daraldıktan sonra
asla genişleyemezdi. `resize` + `load` + ilk çağrı.

### Yazar girişinde kitabın görünmemesi (3. ve 4. madde)
Ayrıntı ve kök sebepler için yukarıdaki "ÖNEMLİ: Yazar kullanıcı adları"
bölümüne bak. Onarılan 16 kullanıcı adı:
`emi.n.keven→emin.keven`, `bi.lgi.n.peli.ster→bilgin.pelister`,
`i.smai.l.guler→ismail.guler`, `kadi.r.unal→kadir.unal`,
`muttali.p.hasdemi.r→muttalip.hasdemir`, `rasi.m.karagul→rasim.karagul`,
`sebahatti.n.kazaz→sebahattin.kazaz`, `fati.h.i.sgoren→fatih.isgoren`,
`fati.h.demi.r→fatih.demir`, `sali.h.uyan→salih.uyan`,
`neci.p.yildirim→necip.yildirim`, `i.smai.l.kilicaslan→ismail.kilicaslan`,
`hali.l.oz→halil.oz`, `sahi.n.karatas→sahin.karatas`,
`i.brahi.m.i.nal→ibrahim.inal`, `dr.i.smai.l.guler→dr.ismail.guler`.
**Kullanıcıya bildirilmesi gereken:** bu 16 yazarın kullanıcı adı DEĞİŞTİ.
Not: DOÇ. DR. ERDAL KILIÇ'ın kullanıcı adı `doc.dr.erdal.kilic` — bozuk değil,
sadece unvanlı olduğu için tahmin edilmesi zor.

### Doğrulama (2026-08-06, dokuzuncu oturum)
- **62 yazarın HEPSİ programla test edildi** (tek tek denemek yerine): her biri
  için gerçek `POST /api/login` çağrısı yapıldı; dönen `authorName` veritabanıyla
  eşleşiyor mu, `YAZAR_KIMLIKLERI` ve `yazar_kullanicilari.js` içinde var mı,
  rafta kartı var mı (yazısı olmayan 5 yazarda OLMAMASI gerekiyor) — **62/62
  sorunsuz, bozuk kullanıcı adı 0.**
- Tarayıcıda elle: `emin.keven` → kendi kitabını görüyor; `erdal.kılıç` (yanlış)
  → giriş REDDEDİLİYOR ve "Bunu mu demek istediniz: doc.dr.erdal.kilic ?"
  öneriyor; `doc.dr.erdal.kilic` → kitabı görüyor.
- **472 makalenin tamamında İçindekiler sayfa numarası gerçek başlangıçla
  karşılaştırıldı** (PyMuPDF). Uyuşmazlık 29 çıktı ama hepsi çok ciltli iki
  yazarın 2. cilt yazılarıydı — testim onları 1. cildin PDF'inde arıyordu
  (4+25=29, tam eşleşme). Gerçek uyuşmazlık **0**.
- Araç çubuğu: 1280 px'te simge moduna geçiyor (çakışma 0), 1600 px'te yazılar
  geri geliyor — ikisi de ekran görüntüsüyle doğrulandı.
- `node --check` dört script + iki üretilen sayfanın satır içi script'leri temiz.
  Konsol hatası yok. Veritabanı: 62 yazar / 472 makale.
- Yedek: `yazarlar_veritabani_yedek_2026-08-06_kullanici_adi_onarimi.json`.

## Son Yapılanlar (2026-08-06, sekizinci oturum)

### Başlık altındaki tarih satırı kaldırıldı
Kullanıcı: "bazı tarihler yanlış." `generate_pdf_kit.js`'te dizgideki
`doc.text(art.date)` silindi. **Ölçüm yapan ÜÇ yer de birlikte güncellendi**
(`calculateArticleGap`, `calculateArticleStartPages`, İçindekiler ölçümü) —
aksi halde her başlıkta ~14 pt hayalet boşluk hesaplanıp yetim-başlık koruması
ve İçindekiler sayfa numaraları kayardı. Word dışa aktarımındaki tarih `<div>`i
ve `.date` CSS'i de silindi. **`art.date` VERİDE DURUYOR** — yönetim paneli ve
flipbook'un düzenleme ekranı kullanıyor, sadece basılı sayfada görünmüyor.
Doğrulama: 59 PDF'in tamamı PyMuPDF ile `gg-Ay-yyyy` kalıbı için tarandı, **0
kalıntı**. (Künyedeki basım tarihi ayrı, ona dokunulmadı.)

### Kırmızı daire ÖZKURBİR logosu kaldırıldı
`a-logo.png` tüm sistemde arandı, tek yerde duruyordu: kütüphane başlığındaki
iki kopya (`build_library.js`). Kaldırıldı — giriş sayfasında zaten
kaldırılmıştı, artık iki sayfa tutarlı. **Kitabın içinde bu logo hiç yoktu:**
`kapak.png` lacivert/altın amblem taşıyor, `arkakapak.png`'de altın kitap
simgesi var, iç sayfalarda hiç görsel basılmıyor. Sayfa aralarındaki kırmızı
Selçuklu baklava ayracına DOKUNULMADI (o logo değil, süsleme). `a-logo.png`
dosyası silinmedi, HTML'de geri alma yorumu bırakıldı.

### "Yeni sekmede aç" + flipbook'ta kitap kimliği adres satırında
Kapağın üzerine gelince sağ üst köşede `.yeni-sekme-btn` beliriyor (gerçek
`<a target="_blank" rel="noopener">`, bu yüzden orta tık/Ctrl+tık da çalışıyor;
`event.stopPropagation()` ile kartın kendi tıklaması tetiklenmiyor).
**Asıl iş flipbook tarafındaydı:** okuyucu kitabı yalnızca localStorage'dan
okuyordu, o da tüm sekmelerde ORTAK — ikinci kitabı yeni sekmede açmak
birincisini bozardı. Artık `?kitap=&ad=` parametreleri öncelikli; kimliği
okuyan **dokuz yer** tek `AKTIF_KITAP`/`AKTIF_AD` çiftine bağlandı. Parametre
yoksa eski localStorage akışı aynen çalışır. Kimlik `data/<ID>.js` dosya adına
dönüştüğü için adresten geleni `[^A-Za-z0-9_]` süzgecinden geçiyor.
Düğme KAPAĞIN sağ üstüne hizalanır (`--kapak-g` değişkeni, üç kırılma
noktasında da doğru); dokunmatikte yazı gizlenip 26×26 ok simgesine dönüşür.
Çok ciltli yazarın raftaki ÖZET kartında düğme YOK (tek kitap değil, cilt
listesi açıyor) — düğmeler modalin içindeki cilt kartlarında.

### Yönetici paneli: elle yazı ekleme + yinelenen başlık kuralı
Ayrıntı için yukarıdaki iki "ÖNEMLİ" bölümüne bak. Ek olarak:
- Tarama modalindeki **"61+ yazar" sabit metni dinamikleşti** →
  `${authors.length}` (şu an 62), her derlemede güncelleniyor.
- **Bekleyen iş kapatıldı:** `/api/save-articles` katı
  `username==='admin' && password==='admin123'` kontrolü yapıyordu;
  `yonetici`/`mektep123` ile giren yönetici 403 alıyordu → `yoneticiMi()`.
- `server.js`'te **üç `exec` çağrısında `cwd` eksikti** (satır 59, 298, 375);
  sunucu program klasörü dışından başlatılırsa `node build_library.js` script'i
  bulamayıp sessizce başarısız oluyordu. `/api/sync`'te zaten vardı. Üçüne de
  `{ cwd: __dirname }` eklendi — sunucu havuz kökünden başlatılarak doğrulandı.

### Flipbook ahşap zemini açık meşe oldu
Kullanıcının verdiği doku 1600x1600 / kalite 82 ile **706 KB**'a indirildi
(eski koyu doku 913 KB, ortalama renk #492919). Dosya adı **bilerek
`ahsap_arka_plan_v2.jpg`** — aynı adla üzerine yazılsaydı tarayıcı önbellekteki
eski görseli gösterirdi. CSS'teki yedek zemin rengi de `rgba(0,0,0,0.8)`
yerine dokunun ortalama tonu `#BA8357` yapıldı (görsel yüklenemezse görünen
renk; siyah kalsaydı sayfa bir an kapkara açılırdı). Eski doku
`ahsap_arka_plan.jpg` adıyla yerinde, artık kullanılmıyor.

### Doğrulama (2026-08-06, sekizinci oturum)
- `node --check`: `server.js`, `scrape.js`, `build_library.js`,
  `generate_pdf_kit.js` + üretilen `mektep_yonetim.html` ve `flipbook/index.html`
  satır içi script'leri ayıklanıp ayrıca kontrol edildi.
- **Elle yazı ekleme uçtan uca:** panelden AHMET CÜNEYT ŞENER'e deneme yazısı
  eklendi → veritabanına düştü, PDF 8 sayfaya çıktı, **İçindekiler'de 2. sırada**
  (sayfa 4), metin PDF'in içinde, flipbook verisi ve panel sayacı güncellendi.
  Sonra deneme kaydı silinip tam yeniden üretim yapıldı, iz kalmadı.
- Koruma yolları: yanlış şifre **403**, boş alan **400**, olmayan yazar **404**,
  aynı başlık **409** — hiçbiri veritabanına dokunmuyor.
- **Yeni sekme:** `?kitap=HAL_L__Z` ile açıldı, localStorage'da BAŞKA kitap
  yazarken bile doğru kitap (26 sayfa) yüklendi → sekme yalıtımı kanıtlandı.
  Parametresiz eski akış da çalışıyor (SEBAHATTİN KAZAZ, 72 sayfa).
- **Sesli okuma:** 6. sayfa (bir yazının İKİNCİ sayfası) açıkken ilk cümle
  "Tutunamama realiteye teslim olmama..." yani sayfanın en üstü — eski kodda
  yazının başına dönüyordu. Masaüstünde [6,7] soldan başlıyor, üst bilgi
  sızıntısı yok. Durum döngüsü: başlat → duraklat (**sayaç 7'de korundu**) →
  devam (aynı cümleden) → durdur (sayaç 0) → tekrar başlat (**sayfa başından**).
  Mod değişimi taklidinde okuma kesilmedi, gerçek sayfa çevirmede durdu.
- **Veritabanı bütünlüğü:** 62 yazar / 472 makale, yinelenen başlık **0**,
  `volumeIndex`/`totalVolumes`/`rawAuthorName` kirliliği **0**, tekrar eden
  isim **0**.
- Tarayıcıda konsol hatası yok; yeni ahşap zemin **200** ile geliyor, gece
  modu ve telefon (375x812) görünümü ekran görüntüsüyle doğrulandı.
- **Test tuzağı (not):** Yinelenme testinde başlığı `toLowerCase()` ile
  bozup gönderdim; bu, Türkçe'de U+0307 birleşen nokta bırakıyor ve ilk
  normalleştirme bunu kaçırıp gereksiz bir kayıt açtı. Kayıt silindi,
  normalleştirme aksan-duyarsız hale getirildi. **Ders:** başlık
  karşılaştırmasını değiştirirken bu uç durum tekrar sınanmalı.

## Son Yapılanlar (2026-08-06, yedinci oturum — yeni kapak + MOBİL UYUM + tek sayfa okuma modu)

### Yeni kapak ve kalibrasyon
- Kullanıcı `kapak.png`'yi değiştirdi ("ÖZEL ÖĞRETİM KURUMLARI BİRLİĞİ **DERNEĞİ**
  YAYINLARI" eklendi, süsleme çizgileri sayfaya ortalandı). Ölçü de değişti:
  **1054x1492 → 1131x1600**, bu yüzden tüm px→pt/%% formülleri yenilendi
  (güncel değerler yukarıdaki "kapak.png" bölümünde).
- **UYARI — kapak dosyası kalitesi:** Dosya `.png` uzantılı ama **içeriği
  JPEG** ve WhatsApp'tan geçtiği için sıkıştırılmış (**332 KB**, önceki kapak
  2,3 MB PNG idi). Ekranda ve PDF'te çalışıyor (PDFKit/tarayıcı içeriği
  sniff ediyor), ama **baskıya gidecekse** tasarım programından orijinal PNG
  dışa aktarılıp üzerine yazılmalı. Ölçü aynı kalırsa kalibrasyon değişmez.
- Yeni kapakta alt lacivert şerit SADECE sol/sağ köşelerde; alt-orta açık renk
  taş zemin. (Tarih yazısı bu yüzden önce laciverte çevrildi, sonra tamamen
  kaldırıldı — bkz. yukarıdaki not.)

### MOBİL UYUM (kullanıcı: "telefonda küçük görünüyor, ekranda kayıyor")
- **`login.html`'de HİÇ medya sorgusu yokmuş.** Telefonda 112 px yatay kayma
  vardı: `.bottom-decor` dekoratif ışık halkası **600 px sabit** genişlikteydi
  (`100vw` yapıldı) ve başlık kendi kutusundan 23 px taşıyordu (1.7rem, çok
  dar ekranda 1.5rem). Ayrıca **iki köşe logosu tamamen kaldırıldı** (kullanıcı
  isteği).
- **`mektep_kutuphane.html`:** başlık 41.6 px'ti, kutusundan 30 px taşıp sayfayı
  385 px'e genişletiyordu (yatay kayma). İki 84 px'lik logo başlığın üzerine
  biniyor, çıkış butonu kart yazılarını kapatıyordu. **Kök sebep: logolar ve
  buton SATIR İÇİ stil kullanıyordu, medya sorgusu onlara ulaşamıyordu** →
  `.header-logo` / `.cikis-btn` CSS sınıflarına taşındı. Telefonda logolar
  gizli (`display:none`), **masaüstünde simetrik yerleşim korundu.**
- **Flipbook'ta GERÇEK BİR HATA:** `.gorunum` `place-items:center` kullanıyor,
  ama sahnenin DÜZEN genişliği (840 px) ekrandan genişse **CSS Grid'in taşma
  güvenliği** `center` hizalamasını `start`'a düşürüyor. Sahne 0'dan başlayınca
  `transform-origin` (420 px) ekran dışında kalıyor ve ölçeklenmiş kitap sağa
  uçuyordu — **telefonda kitap tamamen görünmüyordu, sadece ahşap zemin vardı.**
  Çözüm: `.sahne` mutlak konumlu + `translate(-50%,-50%)` → görünür merkez
  ekran genişliğinden bağımsız. (Bu satır `olcekle()` içinde transform'un EN
  SAĞINDA değil solunda olmalı; en soldaki translate en dış dönüşümdür.)
- Araç çubuğundaki 11 buton 375 px'e sığmıyordu → yatay kaydırılabilir yapıldı,
  560 px altında yazılar gizlenip sadece simge kalıyor. Oklar kitabın yanında
  konumlandığı için ekran dışına düşüyordu → ekran kenarına yapıştırıldı.
  Ölçekleme telefonda da oklar için 140 px ayırıyordu → 16 px.

### TELEFONDA TEK SAYFA OKUMA MODU (`flipbook/index.html`)
375 px'te iki sayfalık A4 açık kitap = sayfa başına ~180 px, metin okunamıyordu.
Bu bir yerleşim hatası değil geometrik sınırdı, CSS ile çözülemezdi.
- **820 px altında tek sayfa gösteriliyor, sayfa ekranı dolduruyor (~2 kat).**
- **Çevirme motoru DEĞİŞMEDİ.** Sahne yine iki sayfalık; sadece istenen yarısı
  ortaya kaydırılıyor (`translateX(±210*ölçek)`) ve ölçek tek sayfaya (420)
  bölünüyor. Böylece 3D animasyon, gece modu, sesli okuma aynen çalışıyor.
- Eşleme: **tek sayılı sayfa = sağ yarı, çift sayılı sayfa = sol yarı.**
  `tekSayfaCevrilen(n) = n tek ? (n-1)/2 : n/2`.
- Bir yaprak çevrilmesi İKİ sayfa adımını karşılar: 1→2 çevirir, 2→3 kaydırır.
- Yeni yardımcılar: `tekSayfa`, `darEkran()`, `tekSayfaCevrilen()`,
  `tekSayfaSagMi()`, `tekSayfaSenkron()` (kaydırıcı/içindekiler cildi
  değiştirdiğinde görünen sayfayı hizalar).
- `ileri`/`geri`/`sayfayaGit`/`kaydiriciDegisti`/`gostergeGuncelle` ve
  `?sayfa=` adres parametresi bu modla eşitlendi. Gösterge telefonda tek
  numara (**13 / 50**), masaüstünde çift (**12-13 / 50**).
- `resize` dinleyicisi artık hem `olcekle()` hem `gostergeGuncelle()` çağırıyor
  → telefon yatay çevrilince mod canlı değişiyor.

### Doğrulama (2026-08-06, yedinci oturum)
- `node --check` üç script + flipbook'un satır içi script'i ayıklanıp ayrıca
  kontrol edildi.
- Kapak dengesi PDF'ten **PyMuPDF ile metin kutusu koordinatları okunarak**
  ölçüldü (piksel taraması altın çizgileri metinden ayıramıyordu): üst 24.0 pt /
  alt 24.6 pt. En uzun isim ("PROF. DR. OSMAN KEMAL KAYRA") 21 pt'de 320.6 pt
  genişlik → 595.3 pt sayfada tek satıra sığıyor.
- Kütüphane + giriş sayfası telefonda (375x812): **yatay kayma 0**, başlık
  taşması 0, kalan logo 0. Masaüstü ekran görüntüsüyle bozulmadığı doğrulandı.
- Flipbook telefonda: metin sayfası tam okunur, gösterge tek numara, ileri/geri
  tek sayfa adımlıyor. Masaüstünde çift sayfa korunuyor, ölçek 0.926 = orijinal
  formülün verdiği değer, kitap tam ortalı.
- **Not:** Ölçüm yaparken `getComputedStyle().transform` CSS geçişi (0.25s)
  sırasında ARA değeri döndürüyor — yanıltıcı. Doğrulama için `style.transform`
  (inline) okunmalı ya da geçiş bitmesi beklenmeli.

## Son Yapılanlar (2026-08-06, altıncı oturum — "Webden Canlı Güncelle" gerçekten çalışır hale getirildi)
Kullanıcının şikâyeti: yönetici panelindeki "🔄 Webden Canlı Güncelle" butonuna
basılıyor ama hiçbir şey olmuyor. Kontrolde ÜÇ ayrı katmanda hata çıktı.

- **Buton sahteydi.** `runClientSync()` yalnızca bir `alert('İnternetten tarama
  başlatıldı!...')` gösteriyordu — hiçbir `fetch`, hiçbir sunucu çağrısı yoktu.
  "Tarama başlatıldı" mesajı gerçek dışıydı, sadece komutu hatırlatıyordu.
  `server.js`'te karşılık gelen bir uç da hiç yazılmamıştı.
- **KRİTİK: `server.js` 2026-08-01 klasör ayrımından beri hiçbir sayfayı
  açamıyordu.** Statik dosyaları `__dirname` (proje kökü) altından servis
  ediyordu ama tüm HTML `web sayfası/`'na taşınmıştı → `login.html` **404**.
  Yani sadece bu buton değil, **tüm API tarafı** (giriş, şifre değiştirme,
  yazı kaydetme) o tarihten beri erişilemezdi; statik önizleme (8133)
  çalıştığı için fark edilmemişti. Yeni `WEB_KOK` sabiti eklendi
  (`path.join(__dirname, 'web sayfası')`), dizin-dışına-çıkma koruması da
  buna göre güncellendi.
- **Yeni uç: `POST /api/sync`** (`server.js`). Yönetici doğrulaması, aynı anda
  ikinci tarama başlatılmasını engelleyen `taramaCalisiyor` kilidi (scrape ve
  build script'leri aynı JSON'a yazdığı için paralel çalışma veriyi bozar),
  30 dakikalık zaman aşımı, 50 MB çıktı tamponu. `veritabaniOzeti()` ile
  tarama öncesi/sonrası yazar+makale sayısı ölçülüp panele döndürülüyor.
- **`yoneticiMi()` yardımcısı eklendi:** `/api/login` esnek yönetici kimlikleri
  kabul ederken (`admin|yonetici|mektep` × `admin123|mektep123|admin|123456`),
  diğer uçlar `username==='admin' && password==='admin123'` diye katı kontrol
  yapıyordu. Yeni uç esnek listeyi kullanıyor. **Açık kalan:**
  `/api/update-password` ve `/api/save-articles` hâlâ katı kontrolde — örn.
  `yonetici`/`mektep123` ile giren yönetici o işlemlerde 403 alır (bkz.
  Next Steps).
- **Panel arayüzü (`build_library.js` → `createAdminHTML`):** `runClientSync()`
  gerçek `fetch('/api/sync')` akışına çevrildi — onay sorusu → saniye sayaçlı
  ilerleme kutusu (`#sync-durum`) → sonuç özeti (öncesi→sonrası sayılar) →
  yeni içerik varsa 3 sn sonra otomatik sayfa yenileme. Tarama sürerken buton
  kilitleniyor ve modal kapatılamıyor. `dosya://` ile açılmışsa hata mesajı
  özel: "bu sayfayı çift tıklayarak açtınız, `http://localhost:3000/login.html`
  kullanın"; statik sunucudaysa hangi adreste olunduğu yazılıyor.
- **`scrape.js` sonsuza kadar asılı kalabiliyordu:** `axios.get()` çağrılarının
  hiçbirinde `timeout` yoktu (axios varsayılanı = sonsuz). Yeni `istekAt()`
  sarmalayıcısı her isteğe 45 sn sınır koyuyor ve başarısızlıkta artan
  aralıklarla 3 kez deniyor; üç `axios.get` çağrısı da buna yönlendirildi.
- **`web sayfası/index.html`** kullanıcı tarafından eklendi (statik hosting'de
  giriş noktası). İncelendi: mantık doğruydu (`location.replace` tercihi
  isabetli — geri tuşu döngüsü olmuyor; dosya adı büyük/küçük harf uyumlu).
  Tek eksik yönlendirmenin tamamen JS'e bağlı olmasıydı → `<meta
  http-equiv="refresh">` ve görünür "buraya tıklayın" bağlantısı yedek olarak
  eklendi, viewport ve koyu tema mesajı kondu.
- **`Mac_Baslat.command`'ın ÇALIŞTIRMA İZNİ YOKTU** (`-rw-rw-rw-`) — kullanıcının
  HTML'e çift tıklamasının asıl sebebi buydu; macOS izinsiz `.command`
  dosyasını çift tıklamada çalıştırmaz. `chmod +x` yapıldı. Ayrıca başlatıcı
  güçlendirildi: Node kurulu değilse anlaşılır hata + indirme adresi, port
  3000 zaten dinleniyorsa ikinci sunucu açmak yerine doğrudan tarayıcıyı
  yönlendirme, pencereyi kapatmama/Ctrl+C uyarısı. `Windows_Baslat.bat` de
  simetrik olarak düzeltildi (`where node` kontrolü, `pause`,
  `cd /d "%~dp0"`).

## Doğrulama (2026-08-06)
- `node --check` → `server.js`, `build_library.js`, `scrape.js` temiz; üretilen
  `mektep_yonetim.html` içindeki satır içi script ayıklanıp ayrıca `node
  --check`'ten geçirildi (template literal kaçışları doğru).
- Statik servis düzeldi: `/login.html` **HTTP 200** (öncesi 404),
  `/mektep_yonetim.html` 200.
- Yetki: yanlış şifre ve `reader` rolü → **403**, tarama başlamıyor.
- **Gerçek uçtan uca tarama 3 kez çalıştırıldı.** İlkinde sitede 1 yeni yazar
  bulundu (**61 → 62**), 58 sn. İkincisi 74 sn, "yeni içerik yok" durumunu
  doğru raporladı. Üçüncüsü (kullanıcının başlattığı) **1002 sn = 16,7 dk**
  sürdü — sebep kod değil, sitenin o an ~12 sn'de yanıt vermesi
  (`curl` ile ölçüldü: 11,3 / 12,4 / 12,9 sn; 62 yazar × 12 sn ≈ 12-13 dk).
  Donma değil, hedef sitenin yavaşlığı; muhtemelen üst üste tarama sonrası
  hız sınırlama.
- **Veritabanı bütünlüğü her taramadan sonra kontrol edildi:**
  `volumeIndex`/`totalVolumes`/`rawAuthorName` kirliliği **0**, tekrarlayan
  isim **yok** — yani eski kalıcı-veri hatası geri gelmedi. Son durum:
  62 yazar / 473 makale. (Tarama öncesi `yazarlar_veritabani.json` yedeklendi.)
- Tarayıcıda (localhost:3000) modal açılışı, saniye sayaçlı ilerleme kutusu ve
  yeşil sonuç özeti ekran görüntüsüyle doğrulandı.
- `index.html` → `login.html` yönlendirmesi `localhost:3000/index.html`
  üzerinden test edildi, doğru sayfaya düştü.
- `Mac_Baslat.command` çalıştırıldı: sunucunun açık olduğunu algılayıp
  tarayıcıyı doğru adrese yönlendirdi.

## Son Yapılanlar (2026-08-02, beşinci oturum)
- **Tam ekran flipbook üst bilgi kartı çakışması düzeltildi:** `flipbook/index.html`
  içine `body.tam-ekran-acik` sınıfı ve `fullscreenchange` dinleyicisi eklendi;
  tam ekrana geçilince `.bilgi-kart` küçülüp `.gorunum` sola kayarak sayfa
  alanının dışına çıkıyor, artık okunan sayfanın üzerine binmiyor.
- **Rol tabanlı görünürlük + kimlik eşleşme hatası düzeltildi:** Yazar kendi
  şifresiyle girdiğinde SADECE kendi kitabını/kitaplarını görüyor; şifresiz
  "okuyucu" girişi her şeyi okuyabiliyor ama hiçbir şeye müdahale edemiyor.
  Bulunan hata: `kemal.tunc`/`mektep123` girişinde hiçbir kitap görünmüyordu
  çünkü `login.html`'in çevrimdışı yedek akışı `authorRealName`'i kullanıcı
  adından tahmin ediyordu, Türkçe karakter temizleme ("kemal.tunc" vs
  "KEMAL TUNÇ") eşleşmiyordu. Çözüm: `build_library.js` artık DB'den
  `username→{name,id}` eşlemesi (`YAZAR_KIMLIKLERI`) üretip
  `mektep_kutuphane.html`'e gömüyor; yazar girişinde kimlik login.html'in
  tahmininden değil bu haritadan çözülüyor.
- **5 maddelik istek uygulandı:** (1) Tüm makale başlıkları büyük harfe
  çevrildi (`generate_pdf_kit.js`'te `.toLocaleUpperCase('tr')`). (2) Kapak
  görseli kullanıcının verdiği `web sayfası/kapak.png` ile değiştirildi
  (bkz. yukarıdaki "kapak.png" notu). (3) Yazar girişinde eklenmiş olan
  "Yazılarım" (makale başlıkları alt alta liste) özelliği kullanıcı isteğiyle
  TAMAMEN kaldırıldı. (4) "Kitap N" etiketi artık çok-ciltli yazarda HER ZAMAN
  gösteriliyor, yeşil ✓ tik sadece o cilt tamamlandıysa ekleniyor (bkz.
  yukarıdaki "ÖNEMLİ: Kitap bölme eşiği" notundaki güncelleme). (5) Yazar
  adı/unvanı kapak görselindeki iki dekoratif çizgi arasındaki boşluğa
  ortalandı (ilk kalibrasyon).
- **Kapak metni 2 kez daha kalibre edildi:** Kullanıcı "isim büyük/yukarıda
  kalmış, çizgiye değiyor" geri bildirimini iki farklı kapak görseli için
  ayrı ayrı verdi (önce ilk `kapak.png`, sonra kullanıcının değiştirdiği
  ikinci — İstanbul Üniversitesi kapısı illüstrasyonlu — `kapak.png`). Her
  ikisinde de PIL/numpy ile çizgi pikselleri yeniden ölçülüp font
  küçültüldü/y kaydırıldı; PDF kapağı (PyMuPDF ile render edilip görsel
  doğrulandı) ve kütüphane kartı CSS'i birlikte güncellendi. Güncel/son
  değerler yukarıdaki "kapak.png" notunda.
- **Çıkış Yap butonu sağ alt köşeye taşındı:** Üst header'daki logo simetrisini
  bozduğu için `mektep_kutuphane.html` header'ından çıkarılıp
  `position:fixed;bottom:20px;right:20px` ile ekranın sağ alt köşesine alındı;
  iki logo artık `top:20px;left:20px` / `top:20px;right:20px` ile bağımsız ve
  simetrik.
- **Okuyucu kısıtlamaları eklendi (flipbook/index.html):** `window.OKUYUCU_MU`
  bayrağı (`role !== 'admin' && role !== 'author'`) eklendi. Okuyucu için PDF
  ve Word indirme butonları (`#pdf-btn`, `#word-btn`) gizleniyor ve
  `pdfIndir()`/`wordIndir()` fonksiyonları erken `return` ile engelleniyor;
  "Paylaş" (`paylasAc()`) okuyucu için çok-ağlı panel yerine doğrudan
  `navigator.share` (veya panosuna kopyalama) ile sadece o sayfanın linkini
  paylaşıyor. Yazar ve yönetici girişlerinde bu fonksiyonlar tam aktif kalıyor.
- **Çok ciltli yazarlar tek kart + popup modal yapısına geçirildi:**
  `build_library.js`'te ana rafta artık çok-ciltli bir yazarın TÜM ciltleri
  tek bir özet kartla (diğer tek-kitaplı yazarlarla birebir aynı stil, altında
  kitap sayısı/tamamlanma özeti) temsil ediliyor. Karta tıklanınca
  `yazarKitaplariniAc(modalId)` ile o yazara ait `.yazar-modal` popup'ı
  açılıyor; içinde her cilt kendi "Kitap N ✓" etiketiyle ayrı kart olarak
  listeleniyor, birine tıklanınca gerçek flipbook okuyucu açılıyor. Modal
  backdrop tıklaması ve Escape tuşu ile kapanıyor.
- **Okuma içeriğinde satır aralığı %50 artırıldı:** `generate_pdf_kit.js`'te
  tüm `lineGap`/`lineSpacing` değerleri (madde araları, gövde metni) 2.2→3.3
  ve 2.5→3.75 yapıldı; Word dışa aktarımdaki CSS `line-height` 1.5→2.25 oldu.
- **Doğrulama:** Her adımdan sonra `node --check` ile script sözdizimi
  kontrol edildi, `node generate_pdf_kit.js` + `node build_library.js` ile
  site yeniden üretildi; localhost:8133 üzerinde tarayıcıda (farklı
  `userRole` değerleriyle) rol kısıtlamaları, modal açılışı, tam ekran
  düzeltmesi ve kapak metni konumu görsel olarak doğrulandı.
- **Henüz yapılmadı:** `backup.sh` çalıştırılmadı — kullanıcıya soruldu,
  onay bekleniyor.

## Son Yapılanlar (2026-08-01, devam)
- **"(Cilt 1)" etiketi kaldırıldı:** Kullanıcı istedi — artık sadece ilk cilt
  adsız kalıyor (`HACER ELBEY`), 2. ve sonraki ciltler ayrım için numaralı
  kalıyor (`HACER ELBEY (Cilt 2)`). İki yerde düzeltme gerekti:
  1. `generate_pdf_kit.js` ve `build_library.js`'teki `expandAuthorsByVolume()`
     — ileride 50+ makaleye çıkan yeni yazarlar için (v===0 → çıplak isim).
  2. Asıl neden burasıydı: `yazarlar_veritabani.json`'da Hacer Elbey ÖNCEDEN
     KALICI OLARAK iki ayrı kayıt halinde saklanıyordu — "HACER ELBEY (Cilt 1)"
     (50 yazı) ve "HACER ELBEY (Cilt 2)" (15 yazı) — bir önceki oturumun
     "50 Makalede Bir Cilt" özelliği çalışma-zamanında değil, veri seviyesinde
     kalıcı yapılmış. `python3` ile JSON'da isim `"HACER ELBEY"` yapıldı
     (yedek: `yazarlar_veritabani_yedek_2026-08-01.json`). **Not:** Başka bir
     yazar ileride 50+ yazıya ulaşırsa AYNI kalıcı-veri deseni tekrarlanmış
     olabilir — "(Cilt 1)" görünürse önce `yazarlar_veritabani.json`'da o adı
     ara, sadece kod tarafına bakma.
  3. Artık üretilmeyen eski `pdf_ciktilari/HACER_ELBEY__CILT_1_.pdf` ve
     `flipbook/data/HACER_ELBEY__CILT_1_.js` dosyaları silindi (yetim kalmışlardı).
- **Kapak görselinde sağ/sol boşluk sorunu düzeltildi:** "ÖZKURBİR YAYINLARI"
  başlığı görselin kenarına çok yakındı (%10.6 boşluk). `mektepkapak.png`
  Pillow ile %90'a küçültülüp aynı 1054×1492 tuvale ALTA YASLANARAK
  (üstte boşluk kalacak şekilde — üst zaten krem/boş olduğu için görünmüyor,
  alt lacivert şerit hâlâ kenara değiyor) ortalanmış hâlde yapıştırıldı. Yeni
  boşluk ~%14.5. Orijinal (küçültülmemiş) hâli `mektepkapak_v2_chatgpt_orijinal.png`
  olarak yedeklendi.
  ⚠️ Bu küçültme yüzünden görsel içindeki boş alanların Y-konumu kaydı —
  `generate_pdf_kit.js` yazar adı/unvan Y'si 507/533 → **528/554** oldu,
  `build_library.js` `.cover-author-overlay` `top: 58%` → **62%** oldu.
  mektepkapak.png BİR DAHA değişirse bu Y-değerleri yine elden geçirilmeli.
- **Kapak sistemi kullanıcı tasarımına geçirildi:** Eski vektör-çizim kapak
  (`generate_pdf_kit.js`'te elle çizilen kitap ikonu + gradyan) kaldırıldı;
  yerine tam sayfa `mektepkapak.png` + üzerine otomatik basılan yazar adı ve
  "Eğitimci Yazar" unvanı geldi. PDFKit'in sayfa-taşma koruması (bottom margin)
  alt lacivert şeritteki tarih metnini ikinci boş sayfaya kaydırıyordu —
  `doc.page.margins.bottom` geçici sıfırlanarak çözüldü.
- **Kapak görseli 2 kez değiştirildi, son hali kalıcı:** İlk sürüm
  (bina/kütüphane girişi illüstrasyonlu) → kullanıcı `ChatGPT Image 1 Ağu 2026
  20_36_14.png` dosyasını getirdi (Ayasofya/cami illüstrasyonlu, "ÖZKURBİR
  YAYINLARI · Mektep Yazıları · Eğitim-Kültür-Medeniyet") → bu artık
  `mektepkapak.png`. Önceki sürüm `mektepkapak_eski_2026-08-01.png` olarak
  yedeklendi, silinmedi.
- **a-logo.pdf düzeltildi:** Kullanıcının eklediği logo dosyası bozuk " .pdf"
  (boşluk+uzantı) adıyla kayıtlıydı, `a-logo.pdf` olarak yeniden adlandırıldı;
  şeffaf arka planlı `a-logo.png` de çıkarılıp kaydedildi. Kapakta KULLANILMADI
  (mektepkapak.png zaten kendi kırmızı ÖZKURBİR amblemini içeriyor) — istenirse
  iç sayfa başlıklarına rozet olarak eklenebilir.
- **Kütüphane kartları (`build_library.js`) gerçek kapağa geçirildi:** Eski
  sahte lacivert/altın CSS mockup (kendi başlığı, ışıklı amblem SVG'si, ayrı
  gradyan paleti) tamamen kaldırıldı. Kart artık `.book-cover` arka planında
  `mektepkapak.png`'i `background-size: cover` ile gösteriyor, üzerine sadece
  yazar adı + "Eğitimci Yazar" yazılıyor.
- **İsim taşma sorunu çözüldü:** Uzun yazar adları (örn. "PROF. DR. OSMAN
  KEMAL KAYRA") önce tek satır + `...` ile kesiliyordu. `.cover-author-name`
  artık `-webkit-line-clamp: 2` ile 2 satıra sarılabiliyor, font küçültüldü;
  tarayıcıda en uzun isimle test edildi, taşma yok.
- **Doğrulama:** `node generate_pdf_kit.js` ve `node build_library.js` ile
  TÜM kütüphane (58 yazar, Hacer Elbey Cilt 1/2 dahil) hatasız yeniden
  üretildi. `pdf_ciktilari/*.pdf` gerçek çıktılarından biri + kütüphane
  sayfası tarayıcıda (localhost:8133) görsel olarak doğrulandı.

## Son Yapılanlar (2026-07-31)
- **Yetim Başlık & Sayfa Sonu Makale Başlangıç Düzeltmesi (Orphan Header Protection):**
  - Sayfa sonlarında makale başlıklarının tek başına kalıp içeriğin diğer sayfaya taşması problemi (Örn: Naci Bektaş'ın *"Az Güzeldir."* makalesi) tamamen çözüldü.
  - Sayfa içi kalan alan eşiği (`spaceNeeded`) 180pt'den **300pt (~10cm)** yüksekliğine çıkarıldı. Bir makalenin sayfa sonunda başlayabilmesi için başlığı, tarihi ve en az 3 paragraf metninin o sayfaya sığması şartı getirildi. Sığmayan makaleler tam zamanında yeni sayfa başına (`doc.addPage()`) aktarılarak kusursuz dizgi sağlandı.
- **Doğal Yapay Zekâ Sesli Okuma & Akıllı Hizalama Güncellemesi:**
  1. **Doğal Türkçe Ses Seçimi:** `SpeechSynthesis` motoru güncellenerek sistemdeki en kaliteli Türkçe yapay zekâ sesleri (`Google Türkçe`, `Apple Yelda/Cem`, `Microsoft Tolga`) otomatik sorgulanıp aktif edildi. Cümle başı ve nokta duraksamaları doğallaştırıldı (`rate: 0.92`). O an açık olan sayfa ve makale metni tam doğrulukla seslendiriliyor. Dinleme sırasında `#sesli-oku-btn` düğmesi altın sarısı aktif rozet kazanır.
  2. **Ortalanmış Üst Araç Çubuğu (`.araclar`):** Sağ üst köşede kenara sıkışan araç düğmeleri tam ortalandı (`left: 50%; transform: translateX(-50%)`).
  3. **Akıllı İçindekiler Paneli Kaydırması (`body.toc-acik`):** Sol taraftan İçindekiler paneli açıldığında 3D kitap ve üst araç çubuğu otomatik olarak sağa kayarak (`left: 320px; width: calc(100% - 320px)`) tam ortalanır. Kitap veya araç düğmeleri asla sol panelin altında kalmaz veya çakışmaz!
- **50 Makalede Bir Cilt (Kitap Bölme) Mimarisi:**
  - Kullanıcının ses kaydındaki directive uyarınca 40 sayfa eşiği yerine **"50 Makalede Bir Kitap"** kuralı uygulandı.
  - 50'den fazla makalesi olan yazarlar (Örn: 65 makalesi bulunan Hacer Elbey) otomatik olarak **HACER ELBEY (Cilt 1)** [50 Yazı] ve **HACER ELBEY (Cilt 2)** [15 Yazı] şeklinde ciltlere bölünerek müstakil kitapçıklara dönüştürüldü.
  - İleride herhangi bir yazar 50 makale eşiğini aştığında sistem otomatik olarak Cilt 1, Cilt 2, Cilt 3 şeklinde cilt üretecektir.
- **Sağ Üst Araç Çubuğu Etiketleri & Prestijli Görünüm (`flipbook/index.html`):**
  - `generate_pdf_kit.js` içerisindeki İçindekiler (TOC) listeleme algoritması yenilendi. Metin çizimi öncesinde `doc.heightOfString()` ile her başlığın yüksekliği hesaplanıp sayfa alt marjin sınırı (`bottomMarginLimit`) önceden denetlenmektedir.
  - PDFKit'in başlık basarken zamansız otomatik sayfa kırması ve sağdaki sayfa numarasını boş/tek kalmış sayfalara atması engellendi. Her İçindekiler sayfası dengeli bir şekilde (~30-34 eleman) doldurulmakta, 65 yazılık Hacer Elbey gibi uzun kitapçıklarda dahi sırasıyla kusursuz ve akıcı olarak sayfalanmaktadır.
- **Ekran Görselleri Üzerindeki 2 Hatanın Düzeltilmesi:**
  1. **Natif PDF Vektörel Selçuklu Motifi:** PDF üreticide font eksikliğinden kaynaklanan kutucuk `[?] [?]` karakter sorunu giderildi. Unicode metin simgesi yerine natif PDFKit vektör çizim motoru ile Selçuklu baklava motifi, altın noktalar ve kırmızı eksen çizgisi (`strokeAndFill`) sıfırdan çizildi. Her cihazda ve PDF okuyucuda %100 vektörel olarak net görünmektedir.
  2. **Üst Araç Çubuğu Çakışma Önleme:** 3D Flipbook okuyucudaki üst araç çubuğunun (`.araclar`) kitap sayfasının en üstündeki başlık yazısının (`HACER ELBEY - MEKTEP YAZILARI`) üzerine biniş problemi giderildi. `.gorunum` konteyneri `top: 65px` mesafesine çekildi ve `olcekle()` dinamik oranlama formülü güncellendi.
- **13 Maddelik Okuyucu & Yayın Tasarım Güncellemesi:**
  1. **İç Sayfa Header:** `"SEÇME YAZILAR"` ifadesi `"MEKTEP YAZILARI"` olarak güncellendi.
  2. **Düz Paragraf Yapısı:** Paragraf başlarındaki boşluklar (`indent`) kaldırılarak tüm paragraflar hizalı düz başlatıldı.
  3. **Yayın Adı:** `"Özkurbir Yayınları"` başlıkları büyük harfle `"ÖZKURBİR YAYINLARI"` yapıldı.
  4. **Ön Kapak Üst Başlık:** `"MEKTEP KÜTÜPHANESİ"` yerine `"ÖZKURBİR YAYINLARI"` getirildi.
  5. **Ön Kapak Alt Başlık:** `"Seçme Yazılar Koleksiyonu"` yerine `"MEKTEP YAZILARI"` yapıldı.
  6. **Yazar Künyesi:** Kapaklarda yazar adının altına `"Naci Bektaş / Eğitimci Yazar"` tarzı künye eklendi.
  7. **Kapak Tarihi:** Kapak altına dinamik oluşturulma tarihi `"ÖZKURBİR YAYINLARI · 31 Temmuz 2026"` eklendi.
  8. **Kapak Görseli:** Sonsuzluk sembolü yerine ÖZKURBİR açık e-kitap vektör amblemi koyuldu.
  9. **İçindekiler Başlığı:** Büyütülerek kırmızı renkte (`#c0392b`) `"İÇİNDEKİLER"` yapıldı.
  10. **İçindekiler Tarih Temizliği:** Tarihler kaldırılarak uzun başlıkların üst üste binmesi engellendi.
  11. **Konu Başlıkları:** Sayfa içlerindeki makale başlıkları kırmızı (`#c0392b`) yapıldı.
  12. **Selçuklu Motifi Çizgi:** Konular arasına Selçuklu baklava motifli vektör ayraç eklendi.
  13. **🔊 Türkçe Sesli Okuma Özelliği:** 3D Flipbook okuyucuya Web Speech API ile Türkçe yapay zeka sesli okuma düğmesi eklendi.




- **Rol Tabanlı Giriş ve Yetkilendirme Portal (`login.html`):** Yönetici (`admin`), Yazarlar ve Okuyucular için rol tabanlı yetki dağıtımı eklendi. Okuyucular salt okunur erişebilir; yazarlar sadece kendi kitapçıklarını düzenleyebilir; yönetici ise tüm kitapçıkları ve yönetici panelini yönetebilir.
- **Yönetici ve Yazar Kimlik Yönetimi:** Yönetici paneline yazar kullanıcı adı ve şifrelerini listeleme ve düzenleme (`bilgileriDuzenle`) eklendi. Yazarların da kendi panelinden kullanıcı adı ve şifrelerini güncelleyebilmesi (`hesapBilgilerimiGuncelle`) sağlandı.
- **İçindekiler Sol Paneli ve Sayfa Gitme:** Kitapçık içindekiler paneli sol taraftan açılacak şekilde güncellendi ve listeden makaleye tıklandığında otomatik o sayfaya gitme eklendi. PDF derleyicisindeki İçindekiler sayfa tasarımları da sağa hizalı sayfa numaralarıyla güncellendi.
- **Göz Koruma Okuma Modu (Gece/Gündüz):** Kitapçık okuyucuya gece modu eklendi. Yüksek çözünürlüklü ve keskin okuma kalitesi için sayfa canvas'ına `invert(1) contrast(1.15) brightness(1.1)` filtre ayarları yapıldı.
- **Premium Sayfa ve Kitap Rozetleri:** 40, 80 ve 120 sayfa sayılarını aşan yazarlar için kitap kapaklarının hemen altında gümüş, altın ve platin madalyalar (her 40 sayfada 1 kitap ödülü) listelendi. Yönetici panelindeki listeye yazı sayısı, sayfa sayısı ve kitap sayısı sütunları eklendi.
- **Dinamik Satır Taşıma Koruması (Dul/Yetim):** PDFKit sayfa geçişlerindeki dul/yetim satırları engellemek için, iki yazı arasındaki 3 satırlık standart boşluğu duruma göre otomatik olarak 2 veya 1 satıra daraltan dinamik sayfa sonu dengeleme kuralı uygulandı.







## Next Steps
- [ ] **16 yazarın kullanıcı adı DEĞİŞTİ** (bkz. dokuzuncu oturum listesi).
      Eski adı bilen yazarlar giriş yapamaz — yeni adlar yönetici panelindeki
      yazar tablosunda görünüyor, yazarlara duyurulmalı.
- [ ] **Sesli okuma GERÇEK SESLE denenmedi.** Önizleme tarayıcısında ses çıkışı
      yok; yalnızca durum makinesi ve metin çıkarımı doğrulandı. Kullanıcı
      gerçek tarayıcıda dinlesin; ses tonu/hızı (`rate: 0.92`) ayarlanabilir.
- [ ] **"Yeni sekmede aç" gerçek tarayıcıda denenmedi** — önizleme paneli
      `target="_blank"` bağlantısını aynı sekmede açıyor (panelin kendi
      davranışı). Bağlantı standart, Chrome/Safari/Firefox'ta yeni sekme açar.
- [ ] **`/api/update-password` hâlâ katı yönetici kontrolünde**
      (`username==='admin' && password==='admin123'`). `/api/save-articles` ve
      `/api/add-article` `yoneticiMi()`'ye geçirildi, bu sonuncu kaldı —
      `yonetici`/`mektep123` ile giren yönetici şifre değiştiremiyor.
- [ ] **Kapak dosyası baskı kalitesi:** `web sayfası/kapak.png` aslında
      WhatsApp'tan geçmiş bir JPEG (332 KB). Baskı planlanıyorsa tasarım
      programından orijinal PNG dışa aktarılıp üzerine yazılmalı. Ölçü
      1131x1600 kalırsa kod tarafında hiçbir şey değişmez.
- [ ] **Çok ciltli yazarın raftaki özet kartında "yeni sekmede" düğmesi yok.**
      Kasıtlı (hangi cilt olduğu belirsiz), ama istenirse "1. kitabı yeni
      sekmede aç" olarak eklenebilir.
- [ ] Ahşap zemin fazla açık gelirse görselin üzerine hafif bir koyulaştırma
      perdesi (`rgba(0,0,0,0.15)`) eklenebilir.
- [ ] `backup.sh` çalıştırılsın mı sorusu hâlâ onay bekliyor.
- [x] **Kütüphanedeki iki ÖZKURBİR logosu kaldırıldı** (2026-08-06) — giriş
      sayfasıyla tutarsızlık giderildi.
- [x] **`/api/save-articles` katı yönetici kontrolü düzeltildi** (2026-08-06).
- [x] Dokümantasyon (`SESSION_STATE.md`, `DASHBOARD.md`, `GUNCELLEME_NOTLARI.md`)
      2026-08-06 sekizinci oturumun tüm değişiklikleriyle güncellendi (bu kayıt).

## Sunucu
İki ayrı sunucu var, karıştırma:
- **`mektep-sunucu` (port 3000)** — `node server.js`. **API'ler yalnız burada
  çalışır:** giriş, şifre değiştirme, yazı kaydetme, `/api/sync` (webden
  güncelle), `/api/add-article` (elle yazı ekle). launch.json'a 2026-08-06'da
  eklendi. Kullanıcı tarafında karşılığı `Mac_Baslat.command`.
- **`mektep-kutuphane` (port 8133)** — sadece statik önizleme. Sayfalar açılır
  ama `/api/*` gerektiren hiçbir şey çalışmaz.

Kütüphane ve flipbook sayfaları `dosya://` ile de görüntülenir (veriler script
etiketiyle yüklenir), ama yine yalnızca okuma amaçlı — bkz. en üstteki
"Kütüphaneyi AÇMA YÖNTEMİ" notu.

