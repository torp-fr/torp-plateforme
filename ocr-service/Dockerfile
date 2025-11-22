FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for pdf2image and PaddleOCR
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Note: PaddleOCR models will be downloaded on first startup (~200MB, 2-3 min)
# This avoids memory issues during build

# Expose port
EXPOSE 8080

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
