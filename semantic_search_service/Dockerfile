FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY . .

# Render automatically sets PORT env var at runtime
ENV CONFIG=/app/app.yml \
    KMP_DUPLICATE_LIB_OK=TRUE

# Use shell form to expand PORT env var (Render sets this automatically)
EXPOSE 8001

CMD uvicorn txtai.api.application:app --host 0.0.0.0 --port ${PORT:-8001}
