#!/bin/bash
# Mektep Kütüphanesi başlatıcı (macOS).
# Bu dosyaya ÇİFT TIKLAYIN — sunucu başlar ve tarayıcı otomatik açılır.
# HTML dosyalarına doğrudan çift tıklamayın: o şekilde açıldığında
# "Webden Canlı Güncelle" gibi sunucu gerektiren özellikler çalışmaz.

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "==================================================="
echo "  MEKTEP KÜTÜPHANESİ BAŞLATILIYOR"
echo "==================================================="
echo

if ! command -v node > /dev/null 2>&1; then
    echo "HATA: Bilgisayarda Node.js kurulu değil."
    echo "https://nodejs.org adresinden indirip kurun, sonra tekrar deneyin."
    echo
    read -n 1 -s -r -p "Kapatmak için bir tuşa basın..."
    exit 1
fi

# Port zaten meşgulse eski sunucu hâlâ açık demektir; tarayıcıyı ona yönlendir.
if lsof -i :3000 -sTCP:LISTEN > /dev/null 2>&1; then
    echo "Sunucu zaten çalışıyor. Kütüphane açılıyor..."
    open "http://localhost:3000/mektep_kutuphane.html"
    echo
    read -n 1 -s -r -p "Bu pencereyi kapatabilirsiniz. Bir tuşa basın..."
    exit 0
fi

echo "Sunucu başlatılıyor... (Bu pencereyi KAPATMAYIN)"
echo "Kütüphaneyi kapatmak için bu pencerede Ctrl+C yapın."
echo

# Sunucuyu arka planda başlat
node server.js &
SERVER_PID=$!

# Sunucunun başlamasını bekle (max 5 sn)
for i in {1..5}; do
    if lsof -i :3000 -sTCP:LISTEN > /dev/null 2>&1; then
        echo "Sunucu açıldı. Kütüphane tarayıcıda açılıyor..."
        sleep 1
        open "http://localhost:3000/mektep_kutuphane.html"
        break
    fi
    sleep 1
done

# Sunucunun kapatılmasını bekle
wait $SERVER_PID

echo
read -n 1 -s -r -p "Sunucu durdu. Kapatmak için bir tuşa basın..."
