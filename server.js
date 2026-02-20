const http = require("node:http");
const { execFile } = require("node:child_process");
const { writeFile, readFile, unlink, mkdtemp } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");

const PORT = process.env.PORT || 3001;
const MAX_BODY = 50 * 1024 * 1024; // 50 MB

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  if (req.method !== "POST" || req.url !== "/convert") {
    res.writeHead(404);
    return res.end("Not found");
  }

  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      res.writeHead(413);
      return res.end("File too large");
    }
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) {
    res.writeHead(400);
    return res.end("Empty body");
  }

  let dir;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "docx-"));
    const input = path.join(dir, "input.docx");
    const output = path.join(dir, "input.pdf");

    await writeFile(input, buffer);

    await new Promise((resolve, reject) => {
      execFile(
        "libreoffice",
        [
          "--headless",
          "--norestore",
          "--convert-to",
          "pdf",
          "--outdir",
          dir,
          input,
        ],
        { timeout: 30_000 },
        (err, _stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve();
        },
      );
    });

    const pdf = await readFile(output);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } catch (err) {
    console.error("Conversion failed:", err.message);
    res.writeHead(500);
    res.end("Conversion failed");
  } finally {
    if (dir) {
      unlink(path.join(dir, "input.docx")).catch(() => {});
      unlink(path.join(dir, "input.pdf")).catch(() => {});
      require("node:fs").rmdir(dir, () => {});
    }
  }
});

server.listen(PORT, () => {
  console.log(`docx-to-pdf listening on :${PORT}`);
});
