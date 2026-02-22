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

    // Per-conversion user profile so parallel requests don't collide
    const userInstall = path.join(dir, "lo-profile");

    await new Promise((resolve, reject) => {
      execFile(
        "libreoffice",
        [
          `-env:UserInstallation=file://${userInstall}`,
          "--headless",
          "--norestore",
          "--convert-to",
          "pdf:writer_pdf_Export",
          "--outdir",
          dir,
          input,
        ],
        { timeout: 60_000 },
        (err, stdout, stderr) => {
          if (err) {
            const detail = [stderr, stdout, err.message]
              .filter(Boolean)
              .join("\n");
            reject(new Error(detail));
          } else {
            resolve();
          }
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
      require("node:fs").rm(dir, { recursive: true, force: true }, () => {});
    }
  }
});

server.listen(PORT, () => {
  console.log(`docx-to-pdf listening on :${PORT}`);
});
