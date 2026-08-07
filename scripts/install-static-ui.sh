#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly DEFAULT_BUNDLE_DIR="${SCRIPT_DIR}/../dist"

bundle_dir="$DEFAULT_BUNDLE_DIR"
static_root=""
backup_dir=""
amule_conf=""
amuleapi_conf=""
bind_address="127.0.0.1"
http_port="4713"
dry_run=false
rollback_dir=""

usage() {
  cat <<'EOF'
Usage:
  scripts/install-static-ui.sh --static-root ABSOLUTE_PATH [options]
  scripts/install-static-ui.sh --rollback BACKUP_DIRECTORY [--dry-run]

Install options:
  --static-root PATH      Absolute directory that amuleapi serves as StaticRoot.
  --bundle-dir PATH       Built bundle to install (default: ./dist).
  --backup-dir PATH       Rollback directory (default: sibling .amule-react-ui-backups/<UTC timestamp>).
  --amule-conf PATH       Patch [AmuleApi] startup values in this explicit amule.conf.
  --amuleapi-conf PATH    Patch [Server] values in this explicit amuleapi.conf.
  --bind-address ADDRESS  API bind address for explicitly supplied config files (default: 127.0.0.1).
  --http-port PORT        API HTTP port for explicitly supplied config files (default: 4713).
  --dry-run               Print planned changes without writing files.
  -h, --help              Show this help.

The helper never writes credentials, restarts services, changes firewall rules,
or modifies aMule source code. Configuration files are changed only when their
explicit paths are supplied.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

notice() {
  printf '%s\n' "$*"
}

require_absolute_safe_path() {
  local path="$1"
  local label="$2"
  [[ "$path" == /* ]] || fail "$label must be an absolute path: $path"
  [[ "$path" != "/" ]] || fail "$label must not be /"
}

validate_port() {
  [[ "$http_port" =~ ^[0-9]+$ ]] || fail "--http-port must be an integer"
  ((http_port >= 1 && http_port <= 65535)) || fail "--http-port must be between 1 and 65535"
}

set_ini_value() {
  local input="$1"
  local output="$2"
  local section="$3"
  local key="$4"
  local value="$5"

  awk -v section="$section" -v key="$key" -v value="$value" '
    BEGIN { in_section = 0; saw_section = 0; wrote_key = 0 }
    /^\[[^]]+\][[:space:]]*$/ {
      if (in_section && !wrote_key) {
        print key "=" value
        wrote_key = 1
      }
      in_section = ($0 == "[" section "]")
      if (in_section) {
        saw_section = 1
        wrote_key = 0
      }
    }
    {
      if (in_section && $0 ~ "^[[:space:]]*" key "[[:space:]]*=") {
        if (!wrote_key) {
          print key "=" value
          wrote_key = 1
        }
        next
      }
      print
    }
    END {
      if (in_section && !wrote_key) {
        print key "=" value
      }
      if (!saw_section) {
        if (NR > 0) print ""
        print "[" section "]"
        print key "=" value
      }
    }
  ' "$input" >"$output"
}

prepare_config() {
  local target="$1"
  local label="$2"
  local section="$3"
  shift 3
  local target_dir
  target_dir="$(dirname -- "$target")"
  [[ -d "$target_dir" ]] || fail "parent directory for $label does not exist: $target_dir"
  [[ -w "$target_dir" ]] || fail "parent directory for $label is not writable: $target_dir"

  local staged
  staged="$(mktemp "${target_dir}/.${label}.amule-react-ui.XXXXXX")"
  staged_configs+=("$staged")
  if [[ -e "$target" ]]; then
    [[ -f "$target" ]] || fail "$label must be a regular file: $target"
    cp -- "$target" "$staged"
  else
    : >"$staged"
  fi

  while (($#)); do
    local key="$1"
    local value="$2"
    local next
    next="$(mktemp "${target_dir}/.${label}.amule-react-ui.XXXXXX")"
    staged_configs+=("$next")
    set_ini_value "$staged" "$next" "$section" "$key" "$value"
    rm -f -- "$staged"
    staged="$next"
    shift 2
  done

  prepared_targets+=("$target")
  prepared_labels+=("$label")
  prepared_staged+=("$staged")
}

validate_config_target() {
  local target="$1"
  local label="$2"
  require_absolute_safe_path "$target" "$label"
  local target_dir
  target_dir="$(dirname -- "$target")"
  [[ -d "$target_dir" ]] || fail "parent directory for $label does not exist: $target_dir"
  [[ -w "$target_dir" ]] || fail "parent directory for $label is not writable: $target_dir"
  if [[ -e "$target" ]]; then
    [[ -f "$target" ]] || fail "$label must be a regular file: $target"
  fi
}

backup_and_replace_config() {
  local target="$1"
  local label="$2"
  local staged="$3"
  local config_backup_dir="${backup_dir}/configs"
  mkdir -p -- "$config_backup_dir"
  printf '%s\n' "$target" >"${config_backup_dir}/${label}.path"

  if [[ -e "$target" ]]; then
    cp -a -- "$target" "${config_backup_dir}/${label}"
  else
    : >"${config_backup_dir}/${label}.absent"
  fi
  mv -- "$staged" "$target"
}

rollback() {
  [[ -d "$rollback_dir" ]] || fail "rollback directory does not exist: $rollback_dir"
  [[ -f "${rollback_dir}/static-root-path" ]] || fail "missing static-root-path in rollback directory"

  local rollback_static_root
  IFS= read -r rollback_static_root <"${rollback_dir}/static-root-path"
  require_absolute_safe_path "$rollback_static_root" "recorded static root"
  [[ -d "${rollback_dir}/static-root" || -f "${rollback_dir}/static-root.absent" ]] ||
    fail "rollback directory has no static-root backup"

  if "$dry_run"; then
    notice "Would restore static root: $rollback_static_root"
    [[ -d "${rollback_dir}/configs" ]] && notice "Would restore supplied aMule configuration files"
    return
  fi

  if [[ -e "$rollback_static_root" ]]; then
    local replaced_root="${rollback_dir}/rollback-replaced-static-root"
    [[ ! -e "$replaced_root" ]] || fail "rollback destination already exists: $replaced_root"
    mv -- "$rollback_static_root" "$replaced_root"
  fi

  if [[ -d "${rollback_dir}/static-root" ]]; then
    mv -- "${rollback_dir}/static-root" "$rollback_static_root"
  fi

  if [[ -d "${rollback_dir}/configs" ]]; then
    local path_file
    while IFS= read -r -d '' path_file; do
      local label="${path_file##*/}"
      label="${label%.path}"
      local target
      IFS= read -r target <"$path_file"
      if [[ -e "$target" ]]; then
        mv -- "$target" "${rollback_dir}/rollback-replaced-${label}"
      fi
      if [[ -f "${rollback_dir}/configs/${label}" ]]; then
        cp -a -- "${rollback_dir}/configs/${label}" "$target"
      fi
    done < <(find "${rollback_dir}/configs" -maxdepth 1 -type f -name '*.path' -print0)
  fi

  notice "Restored deployment from: $rollback_dir"
}

while (($#)); do
  case "$1" in
    --static-root)
      static_root="${2:-}"
      shift 2
      ;;
    --bundle-dir)
      bundle_dir="${2:-}"
      shift 2
      ;;
    --backup-dir)
      backup_dir="${2:-}"
      shift 2
      ;;
    --amule-conf)
      amule_conf="${2:-}"
      shift 2
      ;;
    --amuleapi-conf)
      amuleapi_conf="${2:-}"
      shift 2
      ;;
    --bind-address)
      bind_address="${2:-}"
      shift 2
      ;;
    --http-port)
      http_port="${2:-}"
      shift 2
      ;;
    --rollback)
      rollback_dir="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

if [[ -n "$rollback_dir" ]]; then
  [[ -z "$static_root$amule_conf$amuleapi_conf" ]] || fail "--rollback cannot be combined with install/configuration options"
  rollback
  exit 0
fi

[[ -n "$static_root" ]] || fail "--static-root is required"
require_absolute_safe_path "$static_root" "--static-root"
validate_port
[[ -n "$bind_address" ]] || fail "--bind-address must not be empty"
[[ -d "$bundle_dir" && -f "${bundle_dir}/index.html" ]] ||
  fail "--bundle-dir must contain a built index.html: $bundle_dir"

local_parent="$(dirname -- "$static_root")"
[[ -d "$local_parent" ]] || fail "static-root parent directory does not exist: $local_parent"
[[ -w "$local_parent" ]] || fail "static-root parent directory is not writable: $local_parent"
if [[ -e "$static_root" ]]; then
  [[ -d "$static_root" ]] || fail "--static-root must be a directory when it exists"
  [[ "$bundle_dir" -ef "$static_root" ]] && fail "--bundle-dir and --static-root must be different directories"
fi

if [[ -z "$backup_dir" ]]; then
  backup_dir="${local_parent}/.amule-react-ui-backups/$(date -u +%Y%m%dT%H%M%SZ)"
fi
require_absolute_safe_path "$backup_dir" "--backup-dir"
[[ ! -e "$backup_dir" ]] || fail "backup directory already exists: $backup_dir"

[[ -z "$amule_conf" ]] || validate_config_target "$amule_conf" "--amule-conf"
[[ -z "$amuleapi_conf" ]] || validate_config_target "$amuleapi_conf" "--amuleapi-conf"

if "$dry_run"; then
  notice "Would install bundle: $bundle_dir"
  notice "Would replace static root: $static_root"
  notice "Would create rollback backup: $backup_dir"
  [[ -n "$amule_conf" ]] && notice "Would patch [AmuleApi] in: $amule_conf"
  [[ -n "$amuleapi_conf" ]] && notice "Would patch [Server] in: $amuleapi_conf"
  exit 0
fi

staged_configs=()
prepared_targets=()
prepared_labels=()
prepared_staged=()
stage_dir="$(mktemp -d "${local_parent}/.amule-react-ui-stage.XXXXXX")"
cleanup() {
  rm -rf -- "$stage_dir"
  for staged in "${staged_configs[@]:-}"; do
    [[ -e "$staged" ]] && rm -f -- "$staged"
  done
  return 0
}
trap cleanup EXIT

cp -a -- "${bundle_dir}/." "$stage_dir/"
[[ -f "${stage_dir}/index.html" ]] || fail "staged bundle is missing index.html"

if [[ -n "$amule_conf" ]]; then
  prepare_config "$amule_conf" "amule.conf" "AmuleApi" \
    "Enabled" "1" "BindAddress" "$bind_address" "HttpPort" "$http_port"
fi
if [[ -n "$amuleapi_conf" ]]; then
  prepare_config "$amuleapi_conf" "amuleapi.conf" "Server" \
    "BindAddress" "$bind_address" "Port" "$http_port" "StaticRoot" "$static_root"
fi

mkdir -p -- "$backup_dir"
printf '%s\n' "$static_root" >"${backup_dir}/static-root-path"
if [[ -e "$static_root" ]]; then
  mv -- "$static_root" "${backup_dir}/static-root"
else
  : >"${backup_dir}/static-root.absent"
fi
mv -- "$stage_dir" "$static_root"

for index in "${!prepared_targets[@]}"; do
  backup_and_replace_config "${prepared_targets[$index]}" "${prepared_labels[$index]}" "${prepared_staged[$index]}"
done

notice "Installed static UI at: $static_root"
notice "Rollback directory: $backup_dir"
