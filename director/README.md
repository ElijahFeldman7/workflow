# Hosting on Director (tjhsst.edu)

Director runs each site in a Docker container with 0.6 CPU and 100 MB RAM. That's
too small to run a CRA build, so builds happen on your machine and the container
only pulls the result.

Layout in the container:

```
/site/.deploy-token      secret, created once, never in git
/site/private/           clone of the `director` branch
  run.sh                 what Director executes
  server.js              Express: serves build/, exposes /__deploy
  package.json
  build/                 the built dashboard
```

The app lives in `private/` rather than `public/` so the git checkout and server
source are never web-reachable.

## One-time setup

1. **Site settings** — site type `Dynamic`.

2. **Customize Docker image** — pick a Node Alpine image. In the Packages box add:

   ```
   git
   ```

   Leave `Write run.sh file?` unchecked; we ship our own.

3. **Publish the deploy branch** from your machine:

   ```sh
   ./scripts/deploy-director.sh
   ```

4. **Web terminal** — paste these once:

   ```sh
   head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > /site/.deploy-token
   chmod 600 /site/.deploy-token
   cd /site
   rm -rf private
   git clone --depth 1 --branch director https://github.com/ElijahFeldman7/workflow.git private
   cd private && npm install --omit=dev
   cat /site/.deploy-token; echo
   ```

   Copy the token it prints into `~/.workflow-director-token` on your machine
   (don't paste it into chat or commit it). Then click `Restart process` on the
   site page.

5. **Firebase console** → Authentication → Settings → Authorized domains → add
   `workflow.sites.tjhsst.edu`. Google sign-in fails without this.

## Deploying after that

No terminal, no SSH:

```sh
./scripts/deploy-director.sh
curl -X POST https://workflow.sites.tjhsst.edu/__deploy \
  -H "x-deploy-token: $(cat ~/.workflow-director-token)"
```

`/__deploy` runs a fixed `git fetch` + `git reset --hard` — nothing from the
request reaches the shell. It returns the new commit.

Static assets are read from disk per request, so a pull is live immediately.
Only changes to `server.js` itself need a restart; add `?restart=1` to the
deploy URL for that, or click `Restart process`.

Check what's running:

```sh
curl https://workflow.sites.tjhsst.edu/__health
```

## Notes

- Director has no git webhooks and no plans for them, hence this endpoint.
- SSH: Director's shell server refuses non-interactive sessions (`exec_requested`
  and `subsystem_requested` both return false), so scp/sftp/rsync and
  `ssh host cmd` don't work. TTY only. That's why deploys go over HTTPS instead.
- Custom domain: CNAME to `user.tjhsst.edu`, then add it under `Configure Site`.
