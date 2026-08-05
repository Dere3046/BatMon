#!/system/bin/sh
MODDIR=${0%/*}
DATADIR=/data/adb/batmon
LOG="$DATADIR/batmon.log"
MARK="$MODDIR/loading"
BLOCKED="$MODDIR/blocked"
LKM="$MODDIR/lib/arm64-v8a/lkm"

mkdir -p "$DATADIR"
. "$MODDIR/lib/arm64-v8a/status.sh"

echo "== $(date '+%F %T') boot ==" >> "$LOG"

if [ -f "$MARK" ]; then
    echo "loading marker found, previous install failed or crashed" >> "$LOG"
    touch "$BLOCKED"
    rm -f "$MARK"
    batmon_set_state blocked
elif [ -f "$BLOCKED" ]; then
    echo "blocked by previous failure, skip lkm" >> "$LOG"
    batmon_set_state blocked
else
    r=$(uname -r)
    kv=$(echo "$r" | sed -E 's/^([0-9]+\.[0-9]+).*/\1/')
    atv=$(echo "$r" | sed -E 's/.*-(android[0-9]+)-.*/\1/')
    pagesize=$(echo "$r" | sed -nE 's/.*-(4k|16k)$/\1/p')

    if [ ! -f "$LKM/batmon-${atv}-${kv}.ko" ]; then
        echo "no ko for ${atv}-${kv}" >> "$LOG"
        batmon_set_state no-ko
    else
        if [ -n "$pagesize" ] && [ "$pagesize" != "4k" ]; then
            echo "warn: $pagesize page kernel, module may fail" >> "$LOG"
        fi

        sysctl -w kernel.sched_schedstats=1 >> "$LOG" 2>&1

        touch "$MARK"
        echo "installing $LKM/batmon-${atv}-${kv}.ko" >> "$LOG"

        rmmod batmon 2>/dev/null
        insmod "$LKM/batmon-${atv}-${kv}.ko" >> "$LOG" 2>&1

        if [ -e /proc/batmon/info ]; then
            echo "loaded ok" >> "$LOG"
            rm -f "$MARK"
            batmon_set_state loaded
        else
            echo "insmod failed" >> "$LOG"
            batmon_set_state failed
        fi
    fi
fi

batmon_refresh_desc
