# Profesyonel Eğitim Yayınevi Kalitesinde PDF Tasarım Planı

Mektep Yazar Kitapçıkları için hazırlanan PDF çıktılarının, matbaa kalitesinde (Pearson, Oxford tarzı) ve çok daha profesyonel görünmesi için `generate_pdf_kit.js` altyapısı baştan aşağı yenilenecektir.

## User Review Required

> [!IMPORTANT]
> PDF/X (CMYK) renk uzayı ve tam bleed desteği doğrudan temel `pdfkit` kütüphanesinin varsayılan web kullanımlarında (RGB) bazı sınırlamalara sahiptir. Ancak CMYK renk değerleri ile ve A4 sınırları içerisinde baskıya en yakın kaliteyi (300 DPI hissi, yüksek çözünürlüklü vektör çizimler ve gömülü fontlar) kod ile üreteceğiz.

> [!WARNING]
> Metinlerde (makale içeriklerinde) html etiketleri (Örn: `<blockquote>`, `<ol>`, `<li>`, `<table>` vb.) düz metin olarak kazınmış durumda olabilir. Kutular, alıntılar ve tablolar gibi özel yapıları uygulayabilmemiz için makale içeriklerinin HTML formatında kalması gerekmektedir. Kazıma scriptimiz (scraper) sadece `text()` alıyordu. HTML altyapısına geçiş yapılmasını onaylıyor musunuz?

## Open Questions

1. **İçerik Yapısı:** Makalelerin içindeki tablolar, etkinlikler ve bilgi kutuları web sitesinde belirli bir HTML sınıfına (class) sahip mi? Eğer standart metin şeklindelerse, PDF'te bunları kutu olarak otomatik algılamamız zor olabilir. Sadece başlık ve paragrafları mı özel tasarıma sokalım, yoksa HTML'i koruyup etiketleri mi yorumlayalım?
2. **Kapak Tasarımı:** Kitap kapağında sadece yazar adı mı olacak, yoksa sisteme özel bir tam sayfa kapak tasarımı (Örn: geometrik şekiller, Özkurbir logosu ve yazar adı) yapalım mı?

## Proposed Changes

Mevcut metin tabanlı PDF oluşturucusu, modüler ve yayıncılık standartlarına uygun hale getirilecek.

### `generate_pdf_kit.js`

Mevcut PDF üretim dosyası baştan yazılacak:

#### [MODIFY] generate_pdf_kit.js

1. **Font Entegrasyonu (Gömülü Fontlar):**
   - Google Fonts üzerinden **Inter** (Regular, Italic, Bold) ve **Poppins** (SemiBold, Bold) TTF dosyaları indirilecek ve PDF'e gömülecek.
2. **Sayfa Yapısı ve Marginler:**
   - A4 Boyut, Baskı boşlukları: Üst: 20 mm (56.7 pt), Alt: 22 mm (62.3 pt), İç: 22 mm, Dış: 18 mm. (Tek ve Çift sayfalara göre İç/Dış margin simetrisi ayarlanacak).
3. **Tipografi ve Paragraf:**
   - Gövde metni: Inter, 11.5 pt. Satır aralığı: 1.45 (LineGap ayarı).
   - Paragraf başı: `textIndent` ile 5 mm (yaklaşık 14 pt) boşluk, İki yana yaslı (justify).
4. **Başlık Hiyerarşisi:**
   - Kapak & Ana Bölüm: Poppins 32 pt, Koyu Mavi (`#1E4E79`). Altına ince çizgi (`lineWidth(1)`).
   - Makale Başlığı: Poppins 22 pt, Mavi (`#3B82F6`).
5. **Sayfa Numaralandırma ve Header:**
   - Her sayfanın altına (sol/sağ köşeye) sayfa numarası eklenecek.
   - Her sayfanın üstüne (Header) makale adı veya yazar adı ince/açık gri tonda eklenecek.
6. **Renk Paleti:**
   - Belirtilen renk kodları sabit değişkenler olarak eklenecek.

### `scrape.js` (İsteğe Bağlı Değişiklik)

Eğer kutular, tablolar ve alıntılar kullanılacaksa:
#### [MODIFY] scrape.js
- Makalelerin salt metin (`text()`) olarak değil, PDFKit'in veya HTML-to-PDF dönüştürücülerin anlayabileceği zengin metin (HTML) olarak çekilmesi sağlanacak.

## Verification Plan

### Automated Tests
- Font dosyalarının indirildiğini doğrulayan komutlar çalıştırılacak: `ls -la | grep .ttf`
- `node generate_pdf_kit.js` çalıştırılarak hata alıp almadığı kontrol edilecek.

### Manual Verification
- Üretilen PDF dosyasının (Örn: İsmail Güler'in kitabı) 1-2 sayfası bilgisayarda açılarak kenar boşlukları, paragraf girintileri, yazı tipi boyutları (11.5pt ve 1.45 satır aralığı) ve renk kodlarının doğruluğu gözlemlenecek. Kütüphane arayüzünde PDF'in sorunsuz açıldığı test edilecek.
