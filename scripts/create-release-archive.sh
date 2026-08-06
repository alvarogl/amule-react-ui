#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

output_dir="${PROJECT_ROOT}/release"
version=""
source_date_epoch="${SOURCE_DATE_EPOCH:-}"

usage() {
  cat <<'EOF'
Usage: scripts/create-release-archive.sh [options]

Create a deterministic operator release archive from the current built dist/.

Options:
  --output-dir PATH        Directory for the archive and checksum (default: ./release).
  --version VERSION        Release version (default: package.json version).
  --source-date-epoch SEC  Archive timestamp override (default: current commit timestamp).
  -h, --help               Show this help.

The archive contains dist/, the installer, generic configuration templates,
deployment documentation, README.md, and RELEASE-MANIFEST.json. It never
includes .env files, credentials, runtime configuration, or node_modules.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --output-dir)
      output_dir="${2:-}"
      shift 2
      ;;
    --version)
      version="${2:-}"
      shift 2
      ;;
    --source-date-epoch)
      source_date_epoch="${2:-}"
      shift 2
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

[[ -f "${PROJECT_ROOT}/dist/index.html" ]] ||
  fail "dist/index.html is missing; run pnpm build before packaging"
[[ -f "${PROJECT_ROOT}/package.json" ]] || fail "package.json is missing"

if [[ -z "$version" ]]; then
  version="$(node --input-type=module -e 'import packageJson from "./package.json" with { type: "json" }; process.stdout.write(packageJson.version)' 2>/dev/null)" ||
    fail "could not read package.json version"
fi
[[ "$version" =~ ^[0-9][0-9A-Za-z.+-]*$ ]] || fail "invalid release version: $version"

if [[ -z "$source_date_epoch" ]]; then
  source_date_epoch="$(git -C "$PROJECT_ROOT" log -1 --format=%ct)" || fail "could not read source commit timestamp"
fi
[[ "$source_date_epoch" =~ ^[0-9]+$ ]] || fail "--source-date-epoch must be an integer"

commit="$(git -C "$PROJECT_ROOT" rev-parse HEAD)" || fail "could not read source commit"
archive_name="amule-react-ui-v${version}.tar.gz"
release_root="amule-react-ui-v${version}"
output_dir="$(mkdir -p -- "$output_dir" && cd -- "$output_dir" && pwd -P)"
archive_path="${output_dir}/${archive_name}"
checksum_path="${archive_path}.sha256"
[[ ! -e "$archive_path" && ! -e "$checksum_path" ]] || fail "release output already exists: $archive_path"

stage_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$stage_dir"
  return 0
}
trap cleanup EXIT

archive_stage="${stage_dir}/${release_root}"
mkdir -p -- "${archive_stage}/docs" "${archive_stage}/scripts"
cp -a -- "${PROJECT_ROOT}/dist" "${archive_stage}/dist"
cp -- "${PROJECT_ROOT}/README.md" "${archive_stage}/README.md"
cp -- "${PROJECT_ROOT}/docs/DEPLOYMENT.md" "${archive_stage}/docs/DEPLOYMENT.md"
cp -- "${PROJECT_ROOT}/docs/amule.conf.example" "${archive_stage}/docs/amule.conf.example"
cp -- "${PROJECT_ROOT}/docs/amuleapi.conf.example" "${archive_stage}/docs/amuleapi.conf.example"
cp -- "${PROJECT_ROOT}/scripts/install-static-ui.sh" "${archive_stage}/scripts/install-static-ui.sh"
chmod 755 "${archive_stage}/scripts/install-static-ui.sh"

printf '{\n  "name": "amule-react-ui",\n  "version": "%s",\n  "source_commit": "%s",\n  "source_date_epoch": %s\n}\n' \
  "$version" "$commit" "$source_date_epoch" >"${archive_stage}/RELEASE-MANIFEST.json"

tar --sort=name --mtime="@${source_date_epoch}" --owner=0 --group=0 --numeric-owner \
  --pax-option=delete=atime,delete=ctime -C "$stage_dir" -czf "$archive_path" "$release_root"
(cd "$output_dir" && sha256sum "$archive_name" >"${archive_name}.sha256")

printf 'Created release archive: %s\n' "$archive_path"
printf 'Checksum: %s\n' "$checksum_path"
