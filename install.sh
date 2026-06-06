#!/bin/bash
set -e

echo "======================================"
echo "Установка Media Web Portal (Debian/Ubuntu)"
echo "======================================"

# 1. Update and install dependencies
echo "[1/6] Установка системных зависимостей..."
apt-get update
apt-get install -y python3 python3-pip python3-venv nodejs npm git ffmpeg

# 2. Clone or copy files
INSTALL_DIR="/opt/webportal"
echo "[2/6] Настройка директории $INSTALL_DIR..."
mkdir -p $INSTALL_DIR
cp -r ./* $INSTALL_DIR/

# 3. Setup Python virtual environment and dependencies
echo "[3/6] Настройка виртуального окружения Python..."
cd $INSTALL_DIR
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# 4. Build Frontend
echo "[4/6] Сборка React фронтенда..."
cd frontend_src
npm install
npm run build
mkdir -p ../frontend
cp -r dist ../frontend/
cd ..

# 5. Configure systemd service
echo "[5/6] Настройка службы systemd..."
cat <<EOF > /etc/systemd/system/webportal.service
[Unit]
Description=Media Web Portal
After=network.target

[Service]
User=root
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$INSTALL_DIR/venv/bin"
ExecStart=$INSTALL_DIR/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable webportal
systemctl restart webportal

echo "[6/6] Готово! Портал запущен на порту 8000."
echo "Проверьте статус службы: systemctl status webportal"
