#!/system/bin/sh

case "$ARCH" in
arm64) ;;
*)
    abort "BatMon only supports arm64"
    ;;
esac

chmod 755 "$MODPATH/lib/arm64-v8a/status.sh"
