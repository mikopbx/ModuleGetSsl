# ModuleGetSsl — Free SSL Certificates for MikoPBX

[Русская версия](readme.ru.md)

## What It Does

This module automates obtaining and renewing free SSL certificates from [Let's Encrypt](https://letsencrypt.org/) for your MikoPBX web interface. After setup, the HTTPS certificate is issued automatically and renewed on schedule — no manual steps required.

## Verification Methods

The module supports two verification methods:

### HTTP-01 (default)
The classic method — Let's Encrypt verifies domain ownership by making an HTTP request to your server on port 80. Simple setup: just enter your domain name and click save.

**Requirements:** port 80 accessible from the internet. The module opens it temporarily during verification and closes it immediately after.

### DNS-01
Certificate issuance via your DNS provider's API. No need to open port 80 — works behind firewalls, NAT, and in private networks. Also supports **wildcard certificates** (`*.domain.com`).

**Supported providers (20+):** Cloudflare, Amazon Route53, GoDaddy, DigitalOcean, Hetzner, Yandex Cloud, OVH, Selectel, reg.ru, Beget, Namecheap, Azure DNS, Vultr, DuckDNS, Linode, INWX, DreamHost, deSEC, PowerDNS, ISPConfig, Google Cloud DNS, and any custom provider.

**Setup:** select DNS-01 in the verification method dropdown, choose your DNS provider, enter API credentials, and click save.

## How It Works

1. Install the module from the MikoPBX module marketplace
2. Enter your domain name in the module settings
3. Choose a verification method (HTTP-01 or DNS-01)
4. For DNS-01 — select your DNS provider and enter API credentials
5. Click save — the module requests a certificate from Let's Encrypt, progress is shown in real time
6. Once issued, the certificate is automatically applied to the MikoPBX web interface

Auto-renewal runs on the 1st and 15th of each month. If the certificate is due for renewal, it will be updated automatically.

## Requirements

- MikoPBX **2024.1.114** or newer
- A domain name pointing to your PBX (A record)
- **For HTTP-01:** port **80** accessible from the internet
- **For DNS-01:** API credentials from your DNS provider (no open ports required)

## Technical Details

The module uses [acme.sh](https://github.com/acmesh-official/acme.sh) as the ACME client — a widely used, zero-dependency bash script supporting the full ACME v2 protocol and 150+ DNS providers.

## Documentation

- [English documentation](https://docs.mikopbx.com/mikopbx/v/english/modules/miko/module-get-ssl-lets-encrypt)
- [Документация на русском](https://docs.mikopbx.com/mikopbx/modules/miko/module-get-ssl-lets-encrypt)

## Support

For questions and issues — [help@miko.ru](mailto:help@miko.ru) or the developer channel in Telegram: [@mikopbx_dev](https://t.me/joinchat/AAPn5xSqZIpQnNnCAa3bBw)

## License

GPL-3.0-or-later
