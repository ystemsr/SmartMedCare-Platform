#!/usr/bin/env bash
# Tear down the K3s deployment. Stateful Docker services are untouched.
set -euo pipefail

NS="smartmedcare"

if kubectl get ns "$NS" >/dev/null 2>&1; then
  echo "[k3s-down] deleting namespace $NS"
  kubectl delete ns "$NS" --wait=true
else
  echo "[k3s-down] namespace $NS not present — nothing to do"
fi
