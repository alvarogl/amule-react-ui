#!/bin/sh
set -eu

config_dir=${AMULE_CONFIG_DIR:-/config}
incoming_dir=${AMULE_INCOMING_DIR:-/incoming}
temp_dir=${AMULE_TEMP_DIR:-/temp}
secret_file=${AMULE_ADMIN_PASSWORD_FILE:-/run/secrets/amule_admin_password}
puid=${PUID:-1000}
pgid=${PGID:-1000}
tcp_port=${AMULE_TCP_PORT:-4662}
udp_port=${AMULE_UDP_PORT:-4672}

case "$puid:$pgid:$tcp_port:$udp_port" in
  *[!0-9:]* | :* | *::*) echo "PUID, PGID, AMULE_TCP_PORT, and AMULE_UDP_PORT must be numeric." >&2; exit 64 ;;
esac

for directory in "$config_dir" "$incoming_dir" "$temp_dir"; do
  mkdir -p "$directory"
  chown "$puid:$pgid" "$directory"
  chmod 0750 "$directory"
done

if [ ! -e "$config_dir/amule.conf" ]; then
  if [ ! -r "$secret_file" ]; then
    echo "First boot requires a readable amule_admin_password Docker secret." >&2
    exit 78
  fi

  password=$(tr -d '\r\n' < "$secret_file")
  if [ -z "$password" ]; then
    echo "First boot requires a non-empty amule_admin_password Docker secret." >&2
    exit 78
  fi

  umask 077
  # amuled requires an EC credential even though its amuleapi child receives
  # a short-lived token instead. This random stored hash is internal-only:
  # the EC port is loopback-bound and never published by Compose.
  ec_password=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
  cat >"$config_dir/amule.conf" <<EOF
[eMule]
Port=$tcp_port
UDPPort=$udp_port
UDPEnable=1
IncomingDir=$incoming_dir
TempDir=$temp_dir
OSDirectory=$config_dir/

[ExternalConnect]
AcceptExternalConnections=1
ECAddress=127.0.0.1
ECPort=4712
ECPassword=$ec_password

[AmuleApi]
Enabled=1
BindAddress=0.0.0.0
HttpPort=4713
Path=/usr/local/bin/amuleapi

[WebServer]
Enabled=0
EOF
  cat >"$config_dir/amuleapi.conf" <<EOF
[Server]
BindAddress=0.0.0.0
Port=4713
AllowCORS=0
CorsOriginAllowlist=
StaticRoot=/opt/amule-ui

[EC]
Host=127.0.0.1
Port=4712
Password=
Encryption=1

[Auth]
LoginFailureWindowSeconds=60
LoginFailureThreshold=5
LoginLockoutSeconds=300
EOF
  chown "$puid:$pgid" "$config_dir/amule.conf" "$config_dir/amuleapi.conf"
  chmod 0600 "$config_dir/amule.conf" "$config_dir/amuleapi.conf"

  # This one-shot command writes only a salted credential record. Keep the
  # secret out of environment variables, configuration files, and output.
  /usr/local/bin/amuleapi --no-log-file --config-dir="$config_dir" --set-admin-pass="$password" >/dev/null
  unset password
  unset ec_password
  /usr/local/bin/amuleapi --no-log-file --config-dir="$config_dir" --set-guest-pass= >/dev/null
  chown "$puid:$pgid" "$config_dir/amuleapi-passwords" "$config_dir/amuleapi-jwt-secret"
fi

exec gosu "$puid:$pgid" "$@"
