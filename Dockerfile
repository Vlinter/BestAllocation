# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend + Serve Frontend
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Add joblib cache directory
RUN mkdir -p /app/.cache/joblib
ENV JOBLIB_CACHE_DIR=/app/.cache/joblib

# Drop privileges. Nothing here needs root: the only writer is the joblib cache.
# Running as root turned any file-read bug into a full-filesystem read.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port (Render uses PORT env var)
ENV PORT=8000
EXPOSE $PORT

# Start FastAPI server - use shell form to expand PORT variable
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
