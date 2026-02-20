# docx-to-pdf

Minimal HTTP service that converts DOCX files to PDF using LibreOffice.

## Usage

```bash
docker compose up -d
```

Convert a file:

```bash
curl -X POST http://localhost:3001/convert \
  --data-binary @document.docx \
  -o output.pdf
```

Health check:

```bash
curl http://localhost:3001/health
```

## API

### `POST /convert`

Send a `.docx` file as the raw request body. Returns the converted PDF.

### `GET /health`

Returns `{"status":"ok"}`.

## Deploy

```bash
# On your server
git clone https://github.com/youruser/docx-to-pdf.git
cd docx-to-pdf
docker compose up -d
```

## License

MIT
