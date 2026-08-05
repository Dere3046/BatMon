// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 dere3046
 */

#ifndef BATMON_H
#define BATMON_H

#include <linux/types.h>
#include <linux/pid.h>

#define BATMON_VERSION "0.1.0"

#define BATMON_MAX_TASKS 1024
#define BATMON_HISTORY 2048
#define BATMON_EVENTS 256
#define BATMON_SUSPEND_LOG 64
#define BATMON_TOP 10
#define BATMON_PSY_MAX 16

#define PSY_ALLCANDIDATES { "battery", "main", "bms", "fg", "fuel_gauge", \
			    "gauge", "charger", "usb", "wireless", "ac", \
			    "dc", "otg", "parallel", "sid" }

enum batmon_event_type {
	EVENT_DROP,
	EVENT_DRAIN,
	EVENT_POWER,
	EVENT_GAUGE,
	EVENT_PLUG,
	EVENT_SUSPEND,
	EVENT_RESUME,
	EVENT_LOAD,
	EVENT_UNLOAD,
};

struct batmon_sample {
	u64 ts;        /* boottime ns */
	s64 wall;      /* realtime sec */
	u32 cap;       /* percent, U32_MAX if unavailable */
	u32 volt;      /* mV */
	s32 curr;      /* mA */
	s32 curravg;   /* mA */
	s32 temp;      /* 0.1 C */
	u8 status;
	u8 health;
};

struct batmon_top {
	pid_t pid;
	uid_t uid;
	char comm[16];
	u64 cpu_ms;
	u64 wake;
};

struct batmon_event {
	u64 ts;
	s64 wall;
	u32 type;
	u32 cap_before;
	u32 cap_after;
	u32 volt_before;
	u32 volt_after;
	s32 curr_avg;
	u32 nr_top;
	struct batmon_top top[BATMON_TOP];
};

struct batmon_task {
	pid_t pid;
	uid_t uid;
	char comm[16];
	u64 cpu;       /* sum_exec_runtime ns */
	u64 wake;      /* nr_wakeups */
	u64 sleep;     /* sum_sleep_runtime ns */
	u32 nvcsw;
	u32 nivcsw;
	u64 rbytes;
	u64 wbytes;
};

struct batmon_diff {
	pid_t pid;
	uid_t uid;
	char comm[16];
	u64 cpu_ms;
	u64 wake;
	u64 sleep_ms;
	u32 nvcsw;
	u32 nivcsw;
	u64 rbytes;
	u64 wbytes;
};

struct batmon_drain {
	int rate_1m;      /* %/min x100, INT_MIN if no data */
	int rate_5m;
	int rate_15m;
	int avg_ma_1m;
	int volt_slope_1m; /* mV/min x10 */
	int cur_ma;
	int cap;
	int volt;
	int temp;
};

struct batmon_config {
	unsigned int poll_ms;      /* 5000 */
	unsigned int jump_pct;     /* 200 = 2.00% single sample */
	unsigned int rate_pct_min; /* 100 = 1.00%/min over 60s */
	unsigned int warn_ma;      /* 1000 */
	unsigned int drop_ma;      /* 150, below this means gauge error */
	unsigned int drop_pct_min; /* 300 = 3.00%/min gauge check */
	bool enabled;
	bool log_dmesg;
};

struct batmon_suspend_entry {
	u64 ts;
	s64 wall;
	u64 duration_ms;
	bool resumed;
};

/* batmon.c */
extern struct batmon_config batmon_cfg;
u64 batmon_now_ns(void);
s64 batmon_wall_sec(void);
void batmon_event(u32 type, u32 cap_before, u32 cap_after, u32 volt_before,
		  u32 volt_after, s32 curr_avg);
void batmon_snapshot_tick(void);
struct batmon_task *batmon_snap_current(unsigned int *n);
struct batmon_task *batmon_snap_user_get(unsigned int *n);
void batmon_snap_user_set(const struct batmon_task *snap, unsigned int n);
void batmon_snap_acquire(void);
void batmon_snap_release(void);
void batmon_events_get(struct batmon_event **events, unsigned int *nr,
		       unsigned int *head);
void batmon_suspend_get(struct batmon_suspend_entry **log, unsigned int *nr,
			unsigned int *head);

/* battery.c */
int batmon_battery_init(void);
void batmon_battery_exit(void);
void batmon_sample_tick(void);
const char *batmon_psy_name(void);
struct power_supply *batmon_main_psy(void);
void batmon_history_get(struct batmon_sample **hist, unsigned int *nr,
			unsigned int *head);
int batmon_drain_calc(struct batmon_drain *d);

/* tasks.c */
void batmon_task_snapshot(struct batmon_task *snap, unsigned int *n);
int batmon_build_diff(const struct batmon_task *new,
		      const struct batmon_task *old, unsigned int new_n,
		      unsigned int old_n, struct batmon_diff *out,
		      unsigned int *out_n);
int batmon_diff_top(const struct batmon_task *new, const struct batmon_task *old,
		    unsigned int new_n, unsigned int old_n,
		    struct batmon_top *top, unsigned int *nr);
int batmon_cmp_cpu(const void *a, const void *b);
int batmon_cmp_wake(const void *a, const void *b);

/* proc.c */
int batmon_proc_init(void);
void batmon_proc_exit(void);

#endif
