FROM node:18 AS frontend-builder
WORKDIR /app/frontend_src
COPY frontend_src/package*.json ./
RUN npm install
COPY frontend_src/ ./
RUN npm run build

FROM python:3.10-slim
WORKDIR /opt/webportal

# Install OS dependencies for any native packages
RUN apt-get update && apt-get install -y gcc ffmpeg libsm6 libxext6 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend_src/dist ./frontend/dist

# Expose API port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
