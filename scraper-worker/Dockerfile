FROM mcr.microsoft.com/playwright/python:v1.62.0-noble

WORKDIR /app
ARG WITH_CLOAK=false
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN if [ "$WITH_CLOAK" = "true" ]; then pip install --no-cache-dir -r requirements-cloak.txt; fi
COPY app ./app

ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "app.server"]
