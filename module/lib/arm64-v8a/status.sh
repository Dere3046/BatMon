#!/system/bin/sh

PROP="$MODDIR/module.prop"
STATE="$MODDIR/status.prop"

batmon_clean_desc()
{
    sed -i 's/ *\[[^]]*\] *//g' "$PROP"
}

batmon_set_state()
{
    echo "state=$1" > "$STATE"
}

batmon_refresh_desc()
{
    state=""
    [ -f "$STATE" ] && . "$STATE"
    batmon_clean_desc
    if [ -n "$state" ]; then
        sed -i "s/^description=.*/& [${state}]/" "$PROP"
    fi
}
