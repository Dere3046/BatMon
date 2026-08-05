#!/system/bin/sh

if [ -e /proc/batmon/info ]; then
    rmmod batmon 2>/dev/null
fi
rm -rf /data/adb/batmon
