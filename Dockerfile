FROM python:3.13-slim

WORKDIR /app

# Dépendances système pour Gymnasium / Box2D
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        swig \
        libgl1 \
        libglib2.0-0 \
        libsdl2-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Installer explicitement PyTorch avec CUDA 12.6
RUN pip install --no-cache-dir \
    torch==2.12.1 \
    --index-url https://download.pytorch.org/whl/cu126

# Installer les autres dépendances Python
COPY requirements.txt .

RUN pip install --no-cache-dir \
    -r requirements.txt

# Copier le code du backend et les checkpoints
COPY agents/ ./agents/
COPY inference/ ./inference/
COPY server/ ./server/
COPY models/ ./models/

ENV PYTHONUNBUFFERED=1
ENV SDL_VIDEODRIVER=dummy

EXPOSE 8000

CMD ["python", "-m", "uvicorn", \
     "server.app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000"]
