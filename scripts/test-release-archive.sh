#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
readonly PACKAGER="${SCRIPT_DIR}/create-release-archive.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT

version="$(node --input-type=module -e 'import packageJson from "./package.json" with { type: "json" }; process.stdout.write(packageJson.version)')"
epoch=1700000000
first_output="${fixture}/first"
second_output="${fixture}/second"

(
  cd "$PROJECT_ROOT"
  "$PACKAGER" --output-dir "$first_output" --source-date-epoch "$epoch"
  "$PACKAGER" --output-dir "$second_output" --source-date-epoch "$epoch"
)

archive="amule-react-ui-v${version}.tar.gz"
cmp "${first_output}/${archive}" "${second_output}/${archive}"
(cd "$first_output" && sha256sum --check "${archive}.sha256")

tar -tzf "${first_output}/${archive}" >"${fixture}/contents.txt"
rg -qx "amule-react-ui-v${version}/dist/index.html" "${fixture}/contents.txt"
rg -qx "amule-react-ui-v${version}/scripts/install-static-ui.sh" "${fixture}/contents.txt"
rg -qx "amule-react-ui-v${version}/docs/amuleapi.conf.example" "${fixture}/contents.txt"
rg -qx "amule-react-ui-v${version}/RELEASE-MANIFEST.json" "${fixture}/contents.txt"
! rg -n '(^|/)\.env($|\.)|node_modules|amuleapi-passwords' "${fixture}/contents.txt"

manifest="$(tar -xOzf "${first_output}/${archive}" "amule-react-ui-v${version}/RELEASE-MANIFEST.json")"
printf '%s\n' "$manifest" | rg -q '"name": "amule-react-ui"'
printf '%s\n' "$manifest" | rg -q "\"version\": \"${version}\""
printf '%s\n' "$manifest" | rg -q '"source_date_epoch": 1700000000'

mkdir -p -- "${fixture}/extracted"
tar -xzf "${first_output}/${archive}" -C "${fixture}/extracted"
bash "${fixture}/extracted/amule-react-ui-v${version}/scripts/install-static-ui.sh" --help >/dev/null
