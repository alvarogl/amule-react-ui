#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly INSTALLER="${SCRIPT_DIR}/install-static-ui.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT

source_bundle="${fixture}/source"
static_root="${fixture}/served-ui"
config_dir="${fixture}/config"
backup_dir="${fixture}/backups/release-1"
mkdir -p -- "$source_bundle" "$static_root" "$config_dir" "${fixture}/backups"
printf '<main>new</main>\n' >"${source_bundle}/index.html"
printf '<main>old</main>\n' >"${static_root}/index.html"

printf '%s\n' \
  '[Preferences]' \
  'NickName=operator' \
  '' \
  '[AmuleApi]' \
  'Enabled=0' \
  'BindAddress=127.0.0.1' \
  'HttpPort=9999' >"${config_dir}/amule.conf"
printf '%s\n' \
  '[Server]' \
  'BindAddress=127.0.0.1' \
  'Port=9999' \
  'StaticRoot=/old/ui' >"${config_dir}/amuleapi.conf"

"$INSTALLER" --dry-run --bundle-dir "$source_bundle" --static-root "$static_root" \
  --backup-dir "$backup_dir" --amule-conf "${config_dir}/amule.conf" \
  --amuleapi-conf "${config_dir}/amuleapi.conf" --bind-address 127.0.0.2 --http-port 4714
[[ "$(<"${static_root}/index.html")" == '<main>old</main>' ]]
[[ ! -e "$backup_dir" ]]

"$INSTALLER" --bundle-dir "$source_bundle" --static-root "$static_root" \
  --backup-dir "$backup_dir" --amule-conf "${config_dir}/amule.conf" \
  --amuleapi-conf "${config_dir}/amuleapi.conf" --bind-address 127.0.0.2 --http-port 4714

[[ "$(<"${static_root}/index.html")" == '<main>new</main>' ]]
rg -qx 'Enabled=1' "${config_dir}/amule.conf"
rg -qx 'BindAddress=127.0.0.2' "${config_dir}/amule.conf"
rg -qx 'HttpPort=4714' "${config_dir}/amule.conf"
rg -qx "StaticRoot=${static_root}" "${config_dir}/amuleapi.conf"

"$INSTALLER" --rollback "$backup_dir"
[[ "$(<"${static_root}/index.html")" == '<main>old</main>' ]]
rg -qx 'Enabled=0' "${config_dir}/amule.conf"
rg -qx 'HttpPort=9999' "${config_dir}/amule.conf"
rg -qx 'StaticRoot=/old/ui' "${config_dir}/amuleapi.conf"
