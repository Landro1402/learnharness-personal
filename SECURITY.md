# Security and private data

Do not attach API keys, subscription credentials, conversation exports, audio caches, backups or unredacted logs to issues or pull requests. Use synthetic examples when reproducing a problem.

The runtime keeps provider keys and subscription credentials server-side in local files. Users must supply their own keys; the repository and build artifacts must not include any maintainer credentials. Restrict each key appropriately in its provider console and review its billing settings.

The checked-in `.env.example` contains placeholders only. `.gitignore` protects common runtime locations, but it cannot remove files already tracked or erase earlier commits. Review both the index and history before publishing. Revoke any exposed credential rather than relying on deletion alone.

For a vulnerability in this fork, use GitHub private vulnerability reporting if enabled by the maintainer. If it is unavailable, open an issue requesting a private contact channel without exploit details or secrets. Upstream reports should follow the upstream project's own process.

## Deployment boundary

Use the desktop shell or the default loopback-bound development/start commands. A public or multi-user deployment requires a separate authentication and authorization design. Host and Origin checks reduce browser cross-origin and DNS-rebinding exposure; they do not defend against malicious software already running as the same OS user. Provider keys and subscription tokens are local files protected by OS permissions, not an encrypted vault.

See docs/security-review.md for the dated review and its limitations.
