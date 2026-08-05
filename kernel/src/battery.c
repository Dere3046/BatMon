// SPDX-License-Identifier: GPL-2.0-only
/*
 * Copyright (C) 2026 dere3046
 */

#include <linux/kernel.h>
#include <linux/power_supply.h>
#include <linux/notifier.h>
#include <linux/mutex.h>
#include <linux/math64.h>

#include "batmon.h"

#define PSY_MAIN_CANDIDATES { "battery", "main", "bms", "fg", "fuel_gauge", \
			      "gauge" }
#define PSY_ALLCANDIDATES { "battery", "main", "bms", "fg", "fuel_gauge", \
			    "gauge", "charger", "usb", "wireless", "ac", \
			    "dc", "otg", "parallel", "sid" }
#define PSY_CHARGER_CANDIDATES { "usb", "charger", "wireless", "ac", "dc", \
				 "otg", "main" }

static struct power_supply *batmon_main;
static char batmon_main_name[24];
static DEFINE_MUTEX(batmon_psy_lock);

static struct batmon_sample batmon_history[BATMON_HISTORY];
static unsigned int batmon_history_head;
static unsigned int batmon_history_nr;
static spinlock_t batmon_history_lock;

static struct psy_track {
	char name[24];
	u32 last_status;
	bool known;
} batmon_psy_track[BATMON_PSY_MAX];

static int batmon_psy_nb_call(struct notifier_block *nb,
			      unsigned long event, void *data);

static struct notifier_block batmon_psy_nb = {
	.notifier_call = batmon_psy_nb_call,
};

static const char *const psy_charger_names[] = PSY_CHARGER_CANDIDATES;
static const char *const psy_all_names[] = PSY_ALLCANDIDATES;

static int psy_get_int(struct power_supply *psy,
		       enum power_supply_property prop, int *val)
{
	union power_supply_propval pval;
	int rc;

	rc = power_supply_get_property(psy, prop, &pval);
	if (rc)
		return rc;
	*val = pval.intval;
	return 0;
}

int batmon_psy_get_mv(struct power_supply *psy,
		      enum power_supply_property prop, int *val)
{
	int raw, rc;

	rc = psy_get_int(psy, prop, &raw);
	if (rc)
		return rc;
	*val = raw / 1000;
	return 0;
}

int batmon_psy_get_ma(struct power_supply *psy,
		      enum power_supply_property prop, int *val)
{
	int raw, rc;

	rc = psy_get_int(psy, prop, &raw);
	if (rc)
		return rc;
	if (abs(raw) >= 5000)
		raw /= 1000;
	*val = raw;
	return 0;
}

static bool psy_has_prop(struct power_supply *psy,
			 enum power_supply_property prop)
{
	int val;

	return !psy_get_int(psy, prop, &val);
}

static bool psy_is_charger(const char *name)
{
	size_t i;

	for (i = 0; i < ARRAY_SIZE(psy_charger_names); i++)
		if (!strcmp(name, psy_charger_names[i]))
			return true;
	return false;
}

static void psy_track_update(const char *name)
{
	struct power_supply *psy;
	size_t i, slot = ARRAY_SIZE(batmon_psy_track);
	int status;

	for (i = 0; i < ARRAY_SIZE(batmon_psy_track); i++) {
		if (!batmon_psy_track[i].name[0]) {
			slot = i;
			break;
		}
		if (!strcmp(batmon_psy_track[i].name, name)) {
			slot = i;
			break;
		}
	}
	if (slot >= ARRAY_SIZE(batmon_psy_track))
		return;

	psy = power_supply_get_by_name(name);
	if (!psy)
		return;
	if (!psy_get_int(psy, POWER_SUPPLY_PROP_STATUS, &status)) {
		if (batmon_psy_track[slot].known &&
		    batmon_psy_track[slot].last_status != (u32)status)
			batmon_event(EVENT_PLUG, 0, 0, 0, 0, 0);
		batmon_psy_track[slot].known = true;
		batmon_psy_track[slot].last_status = status;
	} else {
		batmon_psy_track[slot].known = true;
		batmon_psy_track[slot].last_status =
			POWER_SUPPLY_STATUS_UNKNOWN;
	}
	power_supply_put(psy);
}

static int batmon_psy_nb_call(struct notifier_block *nb,
			      unsigned long event, void *data)
{
	struct power_supply *psy = data;

	(void)nb;
	(void)event;

	if (!psy || !psy->desc || !psy->desc->name)
		return NOTIFY_OK;
	if (psy_is_charger(psy->desc->name))
		psy_track_update(psy->desc->name);
	return NOTIFY_OK;
}

static void psy_track_init(void)
{
	size_t i;

	for (i = 0; i < ARRAY_SIZE(psy_charger_names); i++)
		psy_track_update(psy_charger_names[i]);
}

static struct power_supply *psy_find_main(void)
{
	static const char *const names[] = PSY_MAIN_CANDIDATES;
	struct power_supply *psy, *fallback = NULL;
	size_t i;

	for (i = 0; i < ARRAY_SIZE(names); i++) {
		psy = power_supply_get_by_name(names[i]);
		if (!psy)
			continue;
		if (psy_has_prop(psy, POWER_SUPPLY_PROP_CAPACITY)) {
			strscpy(batmon_main_name, psy->desc->name,
				sizeof(batmon_main_name));
			return psy;
		}
		if (!fallback) {
			fallback = psy;
		} else {
			power_supply_put(psy);
		}
	}
	if (fallback) {
		strscpy(batmon_main_name, fallback->desc->name,
			sizeof(batmon_main_name));
		return fallback;
	}
	strscpy(batmon_main_name, "none", sizeof(batmon_main_name));
	return NULL;
}

int batmon_battery_init(void)
{
	spin_lock_init(&batmon_history_lock);
	batmon_main = psy_find_main();
	psy_track_init();
	power_supply_reg_notifier(&batmon_psy_nb);
	return 0;
}

void batmon_battery_exit(void)
{
	power_supply_unreg_notifier(&batmon_psy_nb);
	if (batmon_main)
		power_supply_put(batmon_main);
	batmon_main = NULL;
}

const char *batmon_psy_name(void)
{
	return batmon_main_name;
}

struct power_supply *batmon_main_psy(void)
{
	return batmon_main;
}

static void history_push(struct batmon_sample *s)
{
	unsigned long flags;

	spin_lock_irqsave(&batmon_history_lock, flags);
	batmon_history[batmon_history_head] = *s;
	batmon_history_head = (batmon_history_head + 1) % BATMON_HISTORY;
	if (batmon_history_nr < BATMON_HISTORY)
		batmon_history_nr++;
	spin_unlock_irqrestore(&batmon_history_lock, flags);
}

void batmon_history_get(struct batmon_sample **hist, unsigned int *nr,
			unsigned int *head)
{
	*hist = batmon_history;
	*nr = batmon_history_nr;
	*head = batmon_history_head;
}

static void sample_battery(struct batmon_sample *s)
{
	int val;

	memset(s, 0, sizeof(*s));
	s->ts = batmon_now_ns();
	s->wall = batmon_wall_sec();
	s->cap = U32_MAX;
	s->status = POWER_SUPPLY_STATUS_UNKNOWN;
	s->health = POWER_SUPPLY_HEALTH_UNKNOWN;

	if (!batmon_main)
		return;

	if (!psy_get_int(batmon_main, POWER_SUPPLY_PROP_CAPACITY, &val))
		s->cap = val;
	if (!batmon_psy_get_mv(batmon_main, POWER_SUPPLY_PROP_VOLTAGE_NOW, &val))
		s->volt = val;
	if (!batmon_psy_get_ma(batmon_main, POWER_SUPPLY_PROP_CURRENT_NOW, &val))
		s->curr = val;
	if (!batmon_psy_get_ma(batmon_main, POWER_SUPPLY_PROP_CURRENT_AVG, &val))
		s->curravg = val;
	if (!psy_get_int(batmon_main, POWER_SUPPLY_PROP_TEMP, &val))
		s->temp = val;
	if (!psy_get_int(batmon_main, POWER_SUPPLY_PROP_STATUS, &val))
		s->status = val;
	if (!psy_get_int(batmon_main, POWER_SUPPLY_PROP_HEALTH, &val))
		s->health = val;
}

static unsigned int history_window(struct batmon_sample *newest,
				   unsigned int win_ms, s64 *elapsed,
				   s32 *avg_ma, u32 *oldest_cap,
				   u32 *oldest_volt)
{
	struct batmon_sample *hist;
	unsigned int nr, head, i, idx, cnt = 0;
	s64 cap_sum = 0, el = 0;
	u32 ocap = U32_MAX, ovolt = 0;
	u64 now = newest->ts;
	unsigned long flags;

	spin_lock_irqsave(&batmon_history_lock, flags);
	batmon_history_get(&hist, &nr, &head);
	if (nr) {
		idx = (head + BATMON_HISTORY - 1) % BATMON_HISTORY;
		for (i = 0; i < nr; i++) {
			struct batmon_sample *s = &hist[idx];

			if (now - s->ts > (u64)win_ms * NSEC_PER_MSEC)
				break;
			el = (s64)(now - s->ts) / NSEC_PER_MSEC;
			ocap = s->cap;
			ovolt = s->volt;
			cap_sum += s->curr;
			cnt++;
			idx = (idx + BATMON_HISTORY - 1) % BATMON_HISTORY;
		}
	}
	spin_unlock_irqrestore(&batmon_history_lock, flags);

	if (elapsed)
		*elapsed = el;
	if (avg_ma)
		*avg_ma = cnt ? (s32)div_s64(cap_sum, cnt) : 0;
	if (oldest_cap)
		*oldest_cap = ocap;
	if (oldest_volt)
		*oldest_volt = ovolt;
	return cnt;
}

static void anomaly_check(struct batmon_sample *cur,
			  struct batmon_sample *prev)
{
	u32 ocap, ovolt, cap5;
	s64 elapsed, rate_x100, el5, rate5_x100;
	s32 avg_ma, avg5;
	int jump;
	bool disch;

	if (cur->cap == U32_MAX || prev->cap == U32_MAX)
		return;

	jump = (int)cur->cap - (int)prev->cap;
	disch = cur->status == POWER_SUPPLY_STATUS_DISCHARGING;

	if (history_window(cur, 60000, &elapsed, &avg_ma, &ocap, &ovolt) < 2 ||
	    elapsed < 1000)
		return;

	if (ocap != U32_MAX)
		rate_x100 = ((s64)cur->cap - (s64)ocap) * 100 * 60000 /
			    elapsed;
	else
		rate_x100 = 0;
	if (rate_x100 > 0)
		rate_x100 = 0;

	if (history_window(cur, 300000, &el5, &avg5, &cap5, NULL) >= 2 &&
	    el5 >= 1000 && cap5 != U32_MAX)
		rate5_x100 = ((s64)cur->cap - (s64)cap5) * 100 * 60000 / el5;
	else
		rate5_x100 = 0;
	if (rate5_x100 > 0)
		rate5_x100 = 0;

	if (jump * 100 <= -(s64)batmon_cfg.jump_pct) {
		if (disch && avg_ma < (s32)batmon_cfg.drop_ma)
			batmon_event(EVENT_GAUGE, ocap, cur->cap, ovolt,
				     cur->volt, avg_ma);
		else
			batmon_event(EVENT_DROP, ocap, cur->cap, ovolt,
				     cur->volt, avg_ma);
	} else if (disch && -rate5_x100 >= batmon_cfg.rate_pct_min) {
		batmon_event(EVENT_DRAIN, cap5, cur->cap, 0, cur->volt,
			     avg5);
	}

	if (avg_ma >= (s32)batmon_cfg.warn_ma &&
	    cur->status != POWER_SUPPLY_STATUS_CHARGING)
		batmon_event(EVENT_POWER, ocap, cur->cap, ovolt, cur->volt,
			     avg_ma);

	if (disch && -rate5_x100 >= batmon_cfg.drop_pct_min &&
	    avg5 < (s32)batmon_cfg.drop_ma)
		batmon_event(EVENT_GAUGE, cap5, cur->cap, 0, cur->volt,
			     avg5);
}

void batmon_sample_tick(void)
{
	static struct batmon_sample prev;
	static bool prev_valid;
	struct batmon_sample cur;

	mutex_lock(&batmon_psy_lock);
	if (!batmon_main)
		batmon_main = psy_find_main();
	sample_battery(&cur);
	mutex_unlock(&batmon_psy_lock);

	history_push(&cur);

	if (prev_valid)
		anomaly_check(&cur, &prev);
	prev = cur;
	prev_valid = true;

	batmon_snapshot_tick();
}

int batmon_drain_calc(struct batmon_drain *d)
{
	const struct {
		unsigned int win_ms;
		int *rate;
	} wins[] = {
		{ 60000, &d->rate_1m },
		{ 300000, &d->rate_5m },
		{ 900000, &d->rate_15m },
	};
	struct batmon_sample *hist, *newest = NULL;
	unsigned int nr, head, i, idx;
	u64 now;
	size_t w;
	unsigned long flags;

	d->rate_1m = d->rate_5m = d->rate_15m = INT_MIN;
	d->avg_ma_1m = 0;
	d->volt_slope_1m = INT_MIN;
	d->cur_ma = 0;
	d->cap = -1;
	d->volt = 0;
	d->temp = 0;

	spin_lock_irqsave(&batmon_history_lock, flags);
	batmon_history_get(&hist, &nr, &head);
	if (!nr) {
		spin_unlock_irqrestore(&batmon_history_lock, flags);
		return 0;
	}

	idx = (head + BATMON_HISTORY - 1) % BATMON_HISTORY;
	newest = &hist[idx];
	now = newest->ts;
	d->cap = newest->cap;
	d->volt = newest->volt;
	d->cur_ma = newest->curr;
	d->temp = newest->temp;

	for (w = 0; w < ARRAY_SIZE(wins); w++) {
		struct batmon_sample *oldest = NULL;
		unsigned int cnt = 0;
		s64 cap_sum = 0, el = 0;

		for (i = 0; i < nr; i++) {
			struct batmon_sample *s;

			idx = (head + BATMON_HISTORY - 1 - i) % BATMON_HISTORY;
			s = &hist[idx];
			if (now - s->ts > (u64)wins[w].win_ms * NSEC_PER_MSEC)
				break;
			oldest = s;
			el = (s64)(now - s->ts) / NSEC_PER_MSEC;
			cap_sum += s->curr;
			cnt++;
		}

		if (w == 0)
			d->avg_ma_1m = cnt ? (s32)div_s64(cap_sum, cnt) : 0;
		if (oldest && cnt >= 2 && el > 0 &&
		    oldest->cap != U32_MAX && newest->cap != U32_MAX) {
			s64 delta = (s64)newest->cap - (s64)oldest->cap;
			s64 vdelta = (s64)newest->volt - (s64)oldest->volt;

			*wins[w].rate = (int)(delta * 100 * 60000 / el);
			if (w == 0)
				d->volt_slope_1m =
					(int)(vdelta * 10 * 60000 / el);
		}
	}
	spin_unlock_irqrestore(&batmon_history_lock, flags);
	return 0;
}
