# ModuleGetSsl — Free SSL Certificates for MikoPBX

[Русская версия](readme.ru.md)

## What It Does

This module automates obtaining and renewing free SSL certificates from [Let's Encrypt](https://letsencrypt.org/) for your MikoPBX web interface. After setup, the HTTPS certificate is issued automatically and renewed on schedule — no manual steps required.

## How It Works

1. You install the module from the MikoPBX module marketplace
2. Enter your domain name in the module settings and click save
3. The module requests a certificate from Let's Encrypt, and the progress is shown in real time
4. Once issued, the certificate is automatically applied to the MikoPBX web interface

Auto-renewal runs on the 1st and 15th of each month. If the certificate is due for renewal, it will be updated automatically.

## Requirements

- MikoPBX **2024.1.114** or newer
- A domain name pointing to your PBX public IP address (A record)
- Port **80** accessible from the internet (required for Let's Encrypt HTTP-01 validation)

## Documentation

- [English documentation](https://docs.mikopbx.com/mikopbx/v/english/modules/miko/module-get-ssl-lets-encrypt)
- [Документация на русском](https://docs.mikopbx.com/mikopbx/modules/miko/module-get-ssl-lets-encrypt)

## Support

For questions and issues — [help@miko.ru](mailto:help@miko.ru) or the developer channel in Telegram: [@mikopbx_dev](https://t.me/joinchat/AAPn5xSqZIpQnNnCAa3bBw)

## License

GPL-3.0-or-later
