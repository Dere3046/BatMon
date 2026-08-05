#!/system/bin/sh
MODDIR=${0%/*}
DATADIR=/data/adb/batmon
EXPORT="$DATADIR/export"

. "$MODDIR/lib/arm64-v8a/status.sh"

mkdir -p "$EXPORT"
ts=$(date '+%Y%m%d-%H%M%S')
out="$EXPORT/batmon-${ts}.log"

{
    echo "==== $(date '+%F %T') export ===="
    echo "kernel $(uname -r)"
    if [ -e /proc/batmon/info ]; then
        for f in info battery psy cpu drain history events tasks deltas topwake suspend config; do
            echo "--- /proc/batmon/$f ---"
            cat "/proc/batmon/$f" 2>&1
        done
    else
        echo "batmon not loaded"
    fi
    echo "--- boot log ---"
    cat "$DATADIR/batmon.log" 2>&1
    echo "--- dmesg batmon ---"
    dmesg 2>&1 | grep -i batmon | tail -n 50
} > "$out" 2>&1

rm -f "$MODDIR/loading"
if [ -f "$MODDIR/blocked" ]; then
    rm -f "$MODDIR/blocked"
    batmon_set_state ""
    batmon_refresh_desc
fi

echo "exported to $out"
tail -n 20 "$out"
