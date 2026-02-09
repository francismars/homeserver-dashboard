# Cloudflare Tunnel Setup

Expose your homeserver publicly **without port forwarding** using Cloudflare Tunnel.

## Prerequisites

- [Cloudflare](https://dash.cloudflare.com/) account (free tier works)
- A domain with DNS managed by Cloudflare

## Setup

### 1. Create a Tunnel in Cloudflare

1. Go to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**
2. Click **Create a tunnel** → choose **Cloudflared**
3. Name it (e.g. `pubky-homeserver`)
4. Copy the **Tunnel token**

### 2. Add a Public Hostname

1. In the tunnel config, go to **Public Hostname** → **Add**
2. Set:
   - **Subdomain**: e.g. `pubky`
   - **Domain**: your Cloudflare domain
   - **Service**: HTTP, URL: `homeserver:6286`
3. Save

### 3. Configure in Dashboard

1. Open **Pubky Homeserver** in Umbrel
2. Click the **Settings** icon (gear) → **Cloudflare** tab
3. Enter your **Domain** (e.g. `pubky.yourdomain.com`) and **Tunnel token**
4. Click **Save**
5. **Restart the app** from Umbrel (Stop → Start)

### 4. Verify

- Tunnel shows **Healthy** in Cloudflare dashboard
- `https://pubky.yourdomain.com` loads the homeserver
- Click **Check** in Settings → Cloudflare to test reachability

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tunnel not connecting | Check token is correct; check `cloudflared` container logs |
| Site not loading | Verify hostname points to `homeserver:6286` in Cloudflare |
| Check shows "Not reachable" | Restart the app; wait for tunnel to establish |

## Debug Commands (Umbrel)

SSH into your Umbrel (`ssh umbrel@umbrel.local`) and run these commands:

### Check container status
```bash
sudo docker ps | grep pubky-homeserver
```

### View cloudflared logs (tunnel)
```bash
sudo docker logs pubky-homeserver_cloudflared_1
```
Look for: `Registered tunnel connection` = success

### View homeserver logs
```bash
sudo docker logs pubky-homeserver_homeserver_1
```
Look for: `Published the homeserver's pkarr packet to the DHT`

### Check saved config files
```bash
ls -la ~/umbrel/app-data/pubky-homeserver/cloudflare/
cat ~/umbrel/app-data/pubky-homeserver/cloudflare/domain
cat ~/umbrel/app-data/pubky-homeserver/cloudflare/token
```

### Check PKARR is published
```bash
# Get pubkey from homeserver logs
sudo docker logs pubky-homeserver_homeserver_1 | grep "Pubky TLS listening"

# Query a PKARR relay (replace with your pubkey)
curl https://pkarr.pubky.org/<your-pubkey>
# Binary output warning = success (PKARR records are binary-encoded)

# View the binary response in hex format
curl -s https://pkarr.pubky.org/<your-pubkey> | xxd | head
```

### Restart a specific container
```bash
sudo docker restart pubky-homeserver_cloudflared_1
sudo docker restart pubky-homeserver_homeserver_1
```

### Restart the entire app
```bash
cd ~/umbrel/app-data/pubky-homeserver
sudo docker compose down
sudo docker compose up -d
```

### Watch Umbrel service logs
```bash
sudo journalctl -u umbrel.service -f
```
Useful for seeing app install/start/stop events and errors.

## Notes

- Only the HTTP endpoint (port 6286) is tunneled; Pubky TLS (6287) requires direct connectivity
- The tunnel container downloads `cloudflared` on first start (may take a moment)
- Config is stored in `app-data/pubky-homeserver/cloudflare/`
