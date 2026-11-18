# Manage RLDemo and Surrogate Demo with Docker Compose

This cheat sheet documents how to administer both inference APIs on a headless Ubuntu Server over SSH or VS Code Remote - SSH. Docker Compose runs the backend containers independently of terminal sessions, while a systemd-managed Cloudflare Tunnel makes the APIs reachable from the public frontend.

> **Prerequisites:** Docker Engine and the Docker Compose plugin are installed; the services `rldemo` and `surrogate` are declared in `/home/victor/deploy/compose.yaml`; OpenSSH, Tailscale, and Cloudflare Tunnel have already been configured. These are deployment-specific paths and service names, not requirements for every RLDemo installation.

## 1. Connect to the server

From Windows PowerShell, using the SSH alias configured in `~/.ssh/config`:

```powershell
ssh server
```

Alternatively, open the `server` host using VS Code **Remote - SSH**.

All commands below run **on Ubuntu**, not in Windows PowerShell, unless stated otherwise. Start in the Compose directory:

```bash
cd ~/deploy
```

Use `sudo docker compose` in this setup because the Linux user has not been granted access to the privileged Docker socket.

## 2. Start, stop, and restart services

| Action | Command |
| --- | --- |
| Start both services in the background | `sudo docker compose up -d` |
| Start RLDemo only | `sudo docker compose up -d rldemo` |
| Start Surrogate Demo only | `sudo docker compose up -d surrogate` |
| Stop both services | `sudo docker compose stop` |
| Stop RLDemo only | `sudo docker compose stop rldemo` |
| Stop Surrogate Demo only | `sudo docker compose stop surrogate` |
| Start previously stopped containers | `sudo docker compose start` |
| Restart both services | `sudo docker compose restart` |
| Restart RLDemo only | `sudo docker compose restart rldemo` |
| Restart Surrogate Demo only | `sudo docker compose restart surrogate` |
| Stop and remove project containers and networks | `sudo docker compose down` |

- `up -d` runs containers in **detached mode**: closing SSH or VS Code does not stop the APIs.
- `restart` does **not** rebuild an image or include edits to source code copied into that image.
- `stop` preserves containers so they can be started again; `down` removes project containers and Compose networks. `down` does not normally remove named volumes unless `-v` is supplied.
- With `restart: unless-stopped`, the services normally start after a host reboot, **except** when explicitly stopped before reboot. Start them again with `up -d` if needed.

## 3. View logs

| Action | Command |
| --- | --- |
| Follow all service logs | `sudo docker compose logs -f` |
| Follow RLDemo logs | `sudo docker compose logs -f rldemo` |
| Follow Surrogate Demo logs | `sudo docker compose logs -f surrogate` |
| Last 50 RLDemo lines | `sudo docker compose logs --tail=50 rldemo` |
| Last 50 Surrogate lines | `sudo docker compose logs --tail=50 surrogate` |
| Last 100 lines and follow | `sudo docker compose logs -f --tail=100` |
| Logs from the last 30 minutes | `sudo docker compose logs --since=30m` |
| Logs from both services, with timestamps | `sudo docker compose logs --timestamps rldemo surrogate` |

Press **Ctrl+C** to exit a `logs -f` view. This stops **following the logs**, not the containers.

The `PYTHONUNBUFFERED=1` environment setting makes Python output appear promptly in container logs.

## 4. Check health and resources

```bash
# Service status, published ports, health
sudo docker compose ps

# All Docker containers, including stopped ones
sudo docker ps -a

# Live CPU and RAM use per container (Ctrl+C to exit)
sudo docker stats

# Disk consumption by images, containers, and build cache
sudo docker system df

# Ubuntu disk space
df -h

# NVIDIA GPU status on the host, if the driver is installed
nvidia-smi
```

### API checks from Ubuntu

| Service | Local endpoint | Typical response |
| --- | --- | --- |
| RLDemo | `http://127.0.0.1:8000/health` | `{"status":"online"}` |
| Surrogate Demo | `http://127.0.0.1:8001/health` | `{"status":"ok"}` |

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8001/health

# List Surrogate Demo checkpoints
curl -fsS http://127.0.0.1:8001/models

# List RLDemo environments
curl -fsS http://127.0.0.1:8000/environments
```

A successful `/health` check confirms that the HTTP API responds; **test an actual inference and its WebSocket stream** to validate the full application.

## 5. Update one project without rebuilding the other

The two repositories are checked out separately under `~/apps`. In this deployment, code is **copied into the Docker image at build time**.

### Update RLDemo

```bash
cd ~/apps/RLDemo
git pull

cd ~/deploy
sudo docker compose up -d --build --no-deps rldemo
sudo docker compose logs -f --tail=50 rldemo
```

### Update Surrogate Demo

```bash
cd ~/apps/surrogate-demo
git pull

cd ~/deploy
sudo docker compose up -d --build --no-deps surrogate
sudo docker compose logs -f --tail=50 surrogate
```

The `--no-deps` flag prevents Compose from starting dependencies of the selected service. Naming a service targets the update to that service.

If you modify `compose.yaml` (ports, environment variables, restart policy, etc.), use `up -d` to apply the changes; `restart` alone is insufficient.

Before changing the Compose file:

```bash
sudo docker compose config --quiet
```

### Check which commit is deployed

```bash
git -C ~/apps/RLDemo log -1 --oneline
git -C ~/apps/surrogate-demo log -1 --oneline
```

These commands show local checkouts; after changing code, rebuild the relevant image to deploy it.

## 6. Inspect a running container

```bash
# Open an interactive shell in either running container
sudo docker compose exec rldemo sh
sudo docker compose exec surrogate sh

# Check the Python version in RLDemo
sudo docker compose exec rldemo python --version

# Check PyTorch and CUDA in RLDemo
sudo docker compose exec rldemo python -c 'import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())'

# Check that Surrogate Demo uses CPU PyTorch
sudo docker compose exec surrogate python -c 'import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available())'
```

Use `exit` to leave an interactive container shell. Do not expect persistent code edits made **inside** a container to survive a rebuild; edit the Git repository instead.

## 7. Docker Engine, Cloudflare Tunnel, Tailscale, and SSH

Docker runs the application containers. Cloudflare Tunnel is a separate **systemd** service in this setup.

| Action | Command |
| --- | --- |
| Docker Engine status | `sudo systemctl status docker` |
| Docker starts on boot? | `systemctl is-enabled docker` |
| Restart Docker Engine | `sudo systemctl restart docker` |
| Cloudflare Tunnel status | `sudo systemctl status cloudflared` |
| Cloudflare starts on boot? | `systemctl is-enabled cloudflared` |
| Restart Cloudflare Tunnel | `sudo systemctl restart cloudflared` |
| Follow Cloudflare logs | `sudo journalctl -u cloudflared -f` |
| Tailscale status | `tailscale status` |
| Tailscale starts on boot? | `systemctl is-enabled tailscaled` |
| OpenSSH status | `sudo systemctl status ssh` |
| Firewall rules | `sudo ufw status verbose` |

Cloudflare routes should target the local backend ports:

```text
RLDemo        -> http://127.0.0.1:8000
Surrogate Demo -> http://127.0.0.1:8001
```

Publish Docker ports only on the host loopback interface in Compose, for example:

```yaml
services:
  rldemo:
    ports:
      - "127.0.0.1:8000:8000"

  surrogate:
    ports:
      - "127.0.0.1:8001:8000"
```

The **container** can listen on `0.0.0.0:8000` while the **host** exposes only `127.0.0.1:8000` or `127.0.0.1:8001`. Docker's networking rules can interact with or bypass aspects of UFW; do not accidentally publish a management or inference port on all host interfaces.

Cloudflare Tunnel uses an outbound connection and does not require opening inbound ports on the home router. Public API endpoints still need sensible resource limits, rate limiting, and origin/authentication checks as appropriate; CORS by itself is not access control.

## 8. Reboot and verify automatic recovery

```bash
sudo reboot
```

SSH and VS Code connections drop during reboot. After reconnecting:

```bash
cd ~/deploy
sudo docker compose ps

curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8001/health

systemctl is-active docker cloudflared tailscaled ssh
```

Check the public URLs and start a real inference on **both** frontends. Services configured with `restart: unless-stopped` and an enabled Docker daemon normally return automatically after reboot, without an interactive Linux login.

## 9. Common troubleshooting

| Symptom | What to check |
| --- | --- |
| `ssh server` fails | Tailscale connection, SSH key and alias, Ubuntu power/network, `ssh` service |
| `docker compose` fails | Run from `~/deploy`, check `sudo docker compose config`, inspect Engine status |
| API `/health` does not respond locally | `sudo docker compose ps`, relevant service logs, port binding |
| Public API returns HTTP 502 but local `/health` works | Cloudflare Tunnel service and the public hostname's target port |
| Frontend reports CORS or WebSocket failures | Exact frontend origin, production API URL, WebSocket route, browser DevTools |
| Checkpoints missing | Ensure `models/` and checkpoint files are present inside the built image |
| CUDA fails | `nvidia-smi` on host, NVIDIA Container Toolkit, `gpus: all` when required, PyTorch architecture support |
| Disk filling up | `df -h`, `sudo docker system df`, container log rotation, obsolete images |

Remove unused Docker images cautiously:

```bash
sudo docker image prune
```

This removes **dangling** images, not running containers. Read the confirmation before proceeding. Avoid `docker compose down -v` or aggressive volume pruning unless you intend to delete persistent data.

## 10. Quick-reference commands

```bash
cd ~/deploy

sudo docker compose ps                            # Status
sudo docker compose logs -f --tail=100 rldemo       # RLDemo logs
sudo docker compose logs -f --tail=100 surrogate    # Surrogate logs
sudo docker compose up -d                          # Start both
sudo docker compose stop                           # Stop both
sudo docker compose restart rldemo                 # Restart RLDemo
sudo docker compose restart surrogate              # Restart Surrogate
sudo docker stats                                  # CPU / RAM
```

From **Windows PowerShell**, a one-off remote check without opening an interactive shell is possible:

```powershell
ssh server "cd ~/deploy && sudo docker compose ps"
```

Depending on the server's `sudo` authentication configuration, this may prompt for a password or require an interactive terminal. If so, use `ssh -t server "cd ~/deploy && sudo docker compose ps"` or open your normal SSH session.

---

Related documentation: [RLDemo README](../../README.md) · [Surrogate Demo repository](https://github.com/victrolles/surrogate-demo) · [Render/Vercel deployment tutorial](deploy_render_vercel.md).
