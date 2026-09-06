// Server for the Director (tjhsst.edu) deployment.
// Serves the built CRA bundle and exposes a token-guarded pull endpoint so
// deploys don't require the web terminal.

const crypto = require("crypto");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const express = require("express");

const APP_DIR = __dirname;
const BUILD_DIR = path.join(APP_DIR, "build");
const TOKEN_PATH = process.env.DEPLOY_TOKEN_PATH || "/site/.deploy-token";
const BRANCH = process.env.DEPLOY_BRANCH || "director";

const app = express();

function readToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, "utf8").trim();
  } catch (e) {
    return "";
  }
}

function tokenMatches(given) {
  const expected = readToken();
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function git(args) {
  return new Promise((resolve, reject) => {
    execFile("git", ["-C", APP_DIR].concat(args), { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message));
      else resolve(stdout.trim());
    });
  });
}

app.get("/__health", async (req, res) => {
  let commit = "unknown";
  try {
    commit = await git(["rev-parse", "--short", "HEAD"]);
  } catch (e) {
    // Not a git checkout; that's fine, still report healthy.
  }
  res.json({ ok: true, commit, branch: BRANCH });
});

// Pull the latest build. Only fixed git commands run here; nothing from the
// request reaches the shell.
app.post("/__deploy", async (req, res) => {
  if (!tokenMatches(req.get("x-deploy-token"))) {
    res.status(403).json({ ok: false, error: "bad token" });
    return;
  }

  try {
    await git(["fetch", "--depth", "1", "origin", BRANCH]);
    await git(["reset", "--hard", "FETCH_HEAD"]);
    const commit = await git(["rev-parse", "--short", "HEAD"]);

    const restart = req.query.restart === "1";
    res.json({ ok: true, commit, restarting: restart });

    if (restart) {
      // Static assets are read from disk per request, so a restart is only
      // needed when server.js itself changed.
      setTimeout(() => process.exit(0), 250);
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.use(express.static(BUILD_DIR));

// React Router uses real paths (/app, /terms, /privacy), so unmatched GETs
// fall back to index.html.
app.get("*", (req, res) => {
  res.sendFile(path.join(BUILD_DIR, "index.html"));
});

const port = process.env.PORT || 8080;
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log("workflow listening on " + host + ":" + port);
});
