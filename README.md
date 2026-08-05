# BatMon

Battery drain telemetry LKM for Android GKI kernels.

## usage

install the module zip from releases. at boot the service loads the LKM
matching your kernel version from lib/arm64-v8a/lkm/. a loading marker in
the module dir is removed on success; a leftover marker on the next boot
blocks loading and creates blocked to prevent a crash loop. the action
button exports all telemetry to /data/adb/batmon/export/ and clears the
blocked flag.

the LKM exposes /proc/batmon.

## /proc/batmon

| node | purpose |
|---|---|
| info | module and kernel version, main psy name, uptime |
| battery | live main battery snapshot |
| psy | enumerate all power supplies |
| history | 2048 sample ring (5s each, about 2.8h) |
| events | anomaly events with top 10 process snapshot |
| tasks | per process absolute counters |
| deltas | per process deltas since last read, sorted by cpu |
| topwake | per process deltas sorted by wakeups |
| cpu | per core current and max frequency |
| drain | 1/5/15 min drain rates, avg current, voltage slope |
| suspend | suspend resume history |
| config | tunable parameters |

## config

```sh
echo "poll_ms=2000" > /proc/batmon/config   # sample interval ms
echo "jump_pct=300" > /proc/batmon/config   # single sample drop %
echo "enabled=0" > /proc/batmon/config      # stop sampling entirely
echo "log_dmesg=1" > /proc/batmon/config    # print events to dmesg
```

## license

GPL-2.0
