# Deploying internacia.io to the AX42 server

The server side of [SPEC §11.4](../../docs/SPEC.md#114-dedicated-server-ax42). The server runs other
sites too: its Caddy runs in Docker from a Compose project, called `<compose-dir>` below, whose
`caddy/` directory is mounted at `/etc/caddy`. The server's address and keys are not in this
repository. They are in the repository variables and in the `ax42` environment.

| File | On the server | Role |
|------|---------------|------|
| `internacia-receive` | `/usr/local/bin/internacia-receive` | Only command the deploy key may run: `deploy <sha>`, `rollback`, `list` |
| `setup.sh` | run once as root | Creates `internacia-deploy`, its `authorized_keys`, `/srv/internacia/releases`, installs `internacia-receive` |
| `caddy/internacia-site.caddy` | `<compose-dir>/caddy/internacia/` | Snippet `internacia_site`: root, headers, 404 |
| `caddy/next.caddy` | same | `next.internacia.io`, the test address, `noindex` |
| `caddy/internacia.caddy` | same | `internacia.io` |

`/srv/internacia/current` is a relative symlink to `releases/<UTC time>-<sha>/`. Caddy serves it
read-only. Five releases are kept.

## 1. Server (done 2026-11-23)

As root, from a copy of this directory and the deploy key's public half:

```bash
./setup.sh ax42_deploy.pub
```

The script is idempotent. Run it again after changing `internacia-receive`. The key is an
ed25519 key made for this job only (`ssh-keygen -t ed25519 -N '' -f ax42_deploy`). Its private
half goes only into the GitHub secret.

## 2. Caddy (done 2026-11-23)

1. Copy the three `caddy/*.caddy` files to `<compose-dir>/caddy/internacia/`.
2. In the Caddy service of the Compose file, add the volume `/srv/internacia:/srv/internacia:ro`.
3. At the end of `<compose-dir>/caddy/Caddyfile`, import the snippet only:

   ```caddyfile
   import internacia/internacia-site.caddy
   ```

4. Validate, then recreate the container alone. The mount needs a new container, so every site
   on this Caddy is down for about a second:

   ```bash
   docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   docker compose up -d --no-deps caddy
   ```

Later changes to the `.caddy` files need only a reload:
`docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`.

Import a host file only after its DNS records point at the server. Caddy requests certificates
for all its hosts as soon as it loads the config, and keeps retrying the ones that fail.

## 3. Test address (done 2026-11-23)

In Cloudflare, create `next.internacia.io` A and AAAA records to the server, DNS only. Then add
`import internacia/next.caddy` after the snippet import and reload Caddy. It gets the
certificate within a minute. Then check:

```bash
curl -sI https://next.internacia.io/countries/fr.md   # 200, text/markdown; charset=utf-8, access-control-allow-origin: *
curl -sI https://next.internacia.io/nope/             # 404
```

Run the audit and spot checks against it. It serves the same files as internacia.io.

## 4. Repository settings (done 2026-11-23)

- Environment `ax42`: deployment branches `main` only; secret `AX42_SSH_KEY` (the private key).
  No other copy of the key is kept: to replace it, make a new one, run `setup.sh` with its public
  half and set the secret again.
- Variables: `AX42_HOST` (IPv4 address), `AX42_KNOWN_HOSTS` (`<address> ssh-ed25519 AAAA…`, the
  server's `/etc/ssh/ssh_host_ed25519_key.pub`, checked against the provider's handover), and
  `AX42_SITE_HOST=next.internacia.io`.

The `deploy-ax42` job runs from the next push to `main`, next to the Pages deploy. It fails if
the upload is refused, or if the server does not return this build's `index.html` at
`AX42_SITE_HOST`.

## 5. Moving DNS

1. In Cloudflare, replace the `internacia.io` A and AAAA records (GitHub Pages, SPEC §11.2) with
   the server's addresses, DNS only.
2. On the server, replace `import internacia/next.caddy` with `import internacia/internacia.caddy`.
   Then restart Caddy, so that it requests the certificate at once: `docker compose restart caddy`.
3. Delete the variable `AX42_SITE_HOST`; the job then checks `internacia.io`. Delete the
   `next.internacia.io` records and `next.caddy`.
4. Keep the Pages deploy until the server has run for a while. Moving back is step 1 in reverse.
   Keep the Pages site published after that too: it redirects `datenoio.github.io/internacia-web/`.

## Operations

With the deploy key: `ssh internacia-deploy@<host> list` and `ssh internacia-deploy@<host> rollback`.
As root on the server: `internacia-receive list` and `internacia-receive rollback`. Root runs it
as `internacia-deploy`, so the files keep one owner. A rollback lasts until the next deploy.
