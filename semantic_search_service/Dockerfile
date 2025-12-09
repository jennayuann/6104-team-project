FROM python:3.11-slim

# Avoid writing pyc files and keep logs visible
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CONFIG=/app/app.yml \
    KMP_DUPLICATE_LIB_OK=TRUE

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Expose Fly.io default port
EXPOSE 8080

# Run your app
CMD ["uvicorn", "txtai.api.application:app", "--host", "0.0.0.0", "--port", "8080"]
