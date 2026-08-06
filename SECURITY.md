# Security policy

The UI is intended for trusted local or LAN deployments behind a correctly configured `amuleapi` listener and firewall. Do not expose it directly to the public internet without TLS and an access-control layer.

## Reporting a vulnerability

Do not open a public issue containing credentials, cookies, private network details, or sensitive download information. Use GitHub's private security-advisory reporting flow for this repository, or contact [@alvarogl](https://github.com/alvarogl) privately through GitHub with a minimal reproduction and impact description.

Please include the affected UI commit, browser, deployment topology, and steps needed to reproduce safely. Acknowledgement and remediation priority depend on impact and reproducibility.

## Supported versions

Security fixes are applied to the current `main` branch. Deployments should also keep the underlying aMule source build up to date with upstream security releases.
