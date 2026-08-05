// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 dere3046
 */

#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/slab.h>
#include <linux/string.h>
#include <linux/workqueue.h>
#include <linux/suspend.h>
#include <linux/timekeeping.h>
#include <linux/ktime.h>

#include "batmon.h"

#define BATMON_MODULE_NAME "batmon"

struct batmon_config batmon_cfg = {
	.poll_ms = 5000,
	.jump_pct = 200,
	.rate_pct_min = 100,
	.warn_ma = 1000,
	.drop_ma = 150,
	.drop_pct_min = 300,
	.enabled = true,
	.log_dmesg = false,
};

static struct workqueue_struct *batmon_wq;
static struct delayed_work batmon_work;

static struct batmon_event batmon_events[BATMON_EVENTS];
static unsigned int batmon_events_head;
static unsigned int batmon_events_nr;
static spinlock_t batmon_events_lock;

static u64 batmon_last_event[BATMON_EVENTS];
static const unsigned int batmon_event_throttle[BATMON_EVENTS] = {
	[EVENT_DROP] = 30000,
	[EVENT_DRAIN] = 120000,
	[EVENT_POWER] = 60000,
	[EVENT_GAUGE] = 120000,
	[EVENT_PLUG] = 5000,
	[EVENT_SUSPEND] = 0,
	[EVENT_RESUME] = 0,
	[EVENT_LOAD] = 0,
	[EVENT_UNLOAD] = 0,
};

static struct batmon_task batmon_snap_a[BATMON_MAX_TASKS];
static struct batmon_task batmon_snap_b[BATMON_MAX_TASKS];
static struct batmon_task batmon_snap_user[BATMON_MAX_TASKS];
static unsigned int batmon_snap_n;
static unsigned int batmon_snap_user_n;
static bool batmon_snap_cur_b;
static struct mutex batmon_snap_lock;

static struct batmon_suspend_entry batmon_suspend_log[BATMON_SUSPEND_LOG];
static unsigned int batmon_suspend_head;
static unsigned int batmon_suspend_nr;
static spinlock_t batmon_suspend_lock;

static int batmon_pm_notifier_call(struct notifier_block *nb,
				   unsigned long event, void *data);

static struct notifier_block batmon_pm_nb = {
	.notifier_call = batmon_pm_notifier_call,
};

u64 batmon_now_ns(void)
{
	return ktime_get_boottime_ns();
}

s64 batmon_wall_sec(void)
{
	struct timespec64 ts;

	ktime_get_real_ts64(&ts);
	return ts.tv_sec;
}

void batmon_event(u32 type, u32 cap_before, u32 cap_after, u32 volt_before,
		  u32 volt_after, s32 curr_avg)
{
	struct batmon_event *ev;
	unsigned long flags;
	u64 now = batmon_now_ns();

	if (batmon_event_throttle[type] &&
	    now - batmon_last_event[type] <
		    (u64)batmon_event_throttle[type] * NSEC_PER_MSEC)
		return;
	batmon_last_event[type] = now;

	spin_lock_irqsave(&batmon_events_lock, flags);
	ev = &batmon_events[batmon_events_head];
	batmon_events_head = (batmon_events_head + 1) % BATMON_EVENTS;
	if (batmon_events_nr < BATMON_EVENTS)
		batmon_events_nr++;
	spin_unlock_irqrestore(&batmon_events_lock, flags);

	memset(ev, 0, sizeof(*ev));
	ev->ts = now;
	ev->wall = batmon_wall_sec();
	ev->type = type;
	ev->cap_before = cap_before;
	ev->cap_after = cap_after;
	ev->volt_before = volt_before;
	ev->volt_after = volt_after;
	ev->curr_avg = curr_avg;

	if (type == EVENT_DROP || type == EVENT_DRAIN ||
	    type == EVENT_POWER) {
		struct batmon_task *new, *old;

		mutex_lock(&batmon_snap_lock);
		new = batmon_snap_cur_b ? batmon_snap_b : batmon_snap_a;
		old = batmon_snap_cur_b ? batmon_snap_a : batmon_snap_b;
		batmon_diff_top(new, old, batmon_snap_n, batmon_snap_n,
				ev->top, &ev->nr_top);
		mutex_unlock(&batmon_snap_lock);
	}

	if (batmon_cfg.log_dmesg)
		pr_info("batmon: event %u cap %u->%u volt %u->%u curr %d\n",
			type, cap_before, cap_after, volt_before, volt_after,
			curr_avg);
}

static int batmon_pm_notifier_call(struct notifier_block *nb,
				   unsigned long event, void *data)
{
	struct batmon_suspend_entry *se;
	unsigned long flags;

	(void)nb;
	(void)data;

	if (event == PM_SUSPEND_PREPARE) {
		spin_lock_irqsave(&batmon_suspend_lock, flags);
		se = &batmon_suspend_log[batmon_suspend_head];
		batmon_suspend_head = (batmon_suspend_head + 1) %
				      BATMON_SUSPEND_LOG;
		if (batmon_suspend_nr < BATMON_SUSPEND_LOG)
			batmon_suspend_nr++;
		se->ts = batmon_now_ns();
		se->wall = batmon_wall_sec();
		se->duration_ms = 0;
		se->resumed = false;
		spin_unlock_irqrestore(&batmon_suspend_lock, flags);
		batmon_event(EVENT_SUSPEND, 0, 0, 0, 0, 0);
	} else if (event == PM_POST_SUSPEND) {
		u64 now = batmon_now_ns();

		spin_lock_irqsave(&batmon_suspend_lock, flags);
		se = &batmon_suspend_log[(batmon_suspend_head +
					  BATMON_SUSPEND_LOG - 1) %
					 BATMON_SUSPEND_LOG];
		se->duration_ms = (now - se->ts) / NSEC_PER_MSEC;
		se->resumed = true;
		spin_unlock_irqrestore(&batmon_suspend_lock, flags);
		batmon_event(EVENT_RESUME, 0, 0, 0, 0, 0);
	}
	return NOTIFY_OK;
}

static void batmon_tick(struct work_struct *work)
{
	(void)work;

	if (batmon_cfg.enabled)
		batmon_sample_tick();

	queue_delayed_work(batmon_wq, &batmon_work,
			   msecs_to_jiffies(batmon_cfg.poll_ms));
}

void batmon_snapshot_tick(void)
{
	struct batmon_task *cur;

	mutex_lock(&batmon_snap_lock);
	cur = batmon_snap_cur_b ? batmon_snap_b : batmon_snap_a;
	batmon_task_snapshot(cur, &batmon_snap_n);
	if (!batmon_snap_user_n) {
		memcpy(batmon_snap_user, cur, sizeof(*cur) * batmon_snap_n);
		batmon_snap_user_n = batmon_snap_n;
	}
	batmon_snap_cur_b = !batmon_snap_cur_b;
	mutex_unlock(&batmon_snap_lock);
}

struct batmon_task *batmon_snap_current(unsigned int *n)
{
	*n = batmon_snap_n;
	return batmon_snap_cur_b ? batmon_snap_b : batmon_snap_a;
}

void batmon_snap_acquire(void)
{
	mutex_lock(&batmon_snap_lock);
}

void batmon_snap_release(void)
{
	mutex_unlock(&batmon_snap_lock);
}

struct batmon_task *batmon_snap_user_get(unsigned int *n)
{
	*n = batmon_snap_user_n;
	return batmon_snap_user;
}

void batmon_snap_user_set(const struct batmon_task *snap, unsigned int n)
{
	memcpy(batmon_snap_user, snap, sizeof(*snap) * n);
	batmon_snap_user_n = n;
}

void batmon_events_get(struct batmon_event **events, unsigned int *nr,
		       unsigned int *head)
{
	*events = batmon_events;
	*nr = batmon_events_nr;
	*head = batmon_events_head;
}

void batmon_suspend_get(struct batmon_suspend_entry **log, unsigned int *nr,
			unsigned int *head)
{
	*log = batmon_suspend_log;
	*nr = batmon_suspend_nr;
	*head = batmon_suspend_head;
}

static int __init batmon_init(void)
{
	int rc;

	rc = batmon_battery_init();
	if (rc)
		return rc;

	batmon_wq = alloc_ordered_workqueue(BATMON_MODULE_NAME, WQ_MEM_RECLAIM);
	if (!batmon_wq) {
		rc = -ENOMEM;
		goto err_wq;
	}

	spin_lock_init(&batmon_events_lock);
	spin_lock_init(&batmon_suspend_lock);
	mutex_init(&batmon_snap_lock);

	register_pm_notifier(&batmon_pm_nb);

	rc = batmon_proc_init();
	if (rc)
		goto err_proc;

	INIT_DELAYED_WORK(&batmon_work, batmon_tick);
	queue_delayed_work(batmon_wq, &batmon_work,
			   msecs_to_jiffies(batmon_cfg.poll_ms));

	batmon_event(EVENT_LOAD, 0, 0, 0, 0, 0);
	pr_info("batmon: loaded, battery=%s\n", batmon_psy_name());
	return 0;

err_proc:
	unregister_pm_notifier(&batmon_pm_nb);
	destroy_workqueue(batmon_wq);
err_wq:
	batmon_battery_exit();
	return rc;
}

static void __exit batmon_exit(void)
{
	batmon_event(EVENT_UNLOAD, 0, 0, 0, 0, 0);
	cancel_delayed_work_sync(&batmon_work);
	batmon_proc_exit();
	unregister_pm_notifier(&batmon_pm_nb);
	batmon_battery_exit();
	destroy_workqueue(batmon_wq);
	pr_info("batmon: unloaded\n");
}

module_init(batmon_init);
module_exit(batmon_exit);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("dere3046");
MODULE_DESCRIPTION("Battery drain telemetry and per-process monitoring");
MODULE_VERSION(BATMON_VERSION);
