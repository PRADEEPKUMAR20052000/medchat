FROM python:3.10-slim-buster

WORKDIR /app

COPY . /app

RUN pip install -r requirements.txt

CMD gunicorn --workers 1 --threads 1 --timeout 120 --bind 0.0.0.0:${PORT:-10000} app:app