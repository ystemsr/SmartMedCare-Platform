# NOTE (integration): this Dockerfile expects the build context to be the
# repository ROOT (not ./backend), so that the ML model under
# `data-jobs/models/` can be copied in. The team lead must update
# docker-compose.yml accordingly:
#
#   build:
#     context: .
#     dockerfile: backend/Dockerfile
#
# ---------- build stage ----------
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        pkg-config \
        default-libmysqlclient-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
        libsasl2-dev \
        libsasl2-modules \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
# Install CPU-only PyTorch wheels to keep the image small.
RUN pip install --no-cache-dir --prefix=/install \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt

# ---------- runtime stage ----------
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        default-libmysqlclient-dev \
        libjpeg62-turbo \
        zlib1g \
        libgomp1 \
        libsasl2-2 \
        libsasl2-modules \
        docker.io \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# App source
COPY backend/ /app/

# ML model artifact (lives outside the backend dir)
COPY data-jobs/models/multitask_health_model.pt /app/models/multitask_health_model.pt

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
