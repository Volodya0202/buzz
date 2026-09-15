import assert from "node:assert/strict";
import test from "node:test";

import {
  TIME_PRESETS,
  parseCustomDateTime,
  todayDateString,
} from "./timePresets.ts";

const nowSeconds = () => Math.floor(Date.now() / 1_000);

test("TIME_PRESETS_every_preset_returns_strictly_future_timestamp", () => {
  const now = nowSeconds();
  for (const preset of TIME_PRESETS) {
    assert.ok(
      preset.getTimestamp() > now,
      `${preset.label} must be strictly in the future`,
    );
  }
});

test("TIME_PRESETS_relative_offsets_match_their_labels", () => {
  const before = Date.now() / 1000;
  const presets = TIME_PRESETS;
  const byLabel = Object.fromEntries(
    presets.map((p) => [p.label, p.getTimestamp()]),
  );

  assert.ok(Math.abs(byLabel["Через 30 минут"] - (before + 30 * 60)) <= 2);
  assert.ok(Math.abs(byLabel["Через 1 час"] - (before + 60 * 60)) <= 2);
  assert.ok(Math.abs(byLabel["Через 3 часа"] - (before + 3 * 60 * 60)) <= 2);
});

test("TIME_PRESETS_9am_presets_land_on_a_9am_boundary", () => {
  const presets = TIME_PRESETS;
  const byLabel = Object.fromEntries(
    presets.map((p) => [p.label, p.getTimestamp()]),
  );

  const tomorrow = new Date(byLabel["Завтра в 09:00"] * 1000);
  assert.equal(tomorrow.getHours(), 9);
  assert.equal(tomorrow.getMinutes(), 0);
});

test("TIME_PRESETS_next_monday_lands_on_a_monday", () => {
  const presets = TIME_PRESETS;
  const byLabel = Object.fromEntries(
    presets.map((p) => [p.label, p.getTimestamp()]),
  );

  const nextMonday = new Date(byLabel["В следующий понедельник в 09:00"] * 1000);
  assert.equal(nextMonday.getHours(), 9);
  assert.equal(nextMonday.getMinutes(), 0);
  assert.equal(nextMonday.getDay(), 1); // 0 is Sunday, 1 is Monday
});

test("parseCustomDateTime_future_datetime_returns_timestamp", () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
  const result = parseCustomDateTime(date, "14:30");
  assert.ok(result !== null);
  assert.ok(result > nowSeconds());
});

test("parseCustomDateTime_past_datetime_returns_null", () => {
  // One year ago — unambiguously past regardless of run time.
  const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1_000);
  const date = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
  assert.equal(parseCustomDateTime(date, "09:00"), null);
});

test("parseCustomDateTime_empty_inputs_return_null", () => {
  assert.equal(parseCustomDateTime("", "09:00"), null);
  assert.equal(parseCustomDateTime("2099-01-01", ""), null);
  assert.equal(parseCustomDateTime("", ""), null);
});

test("parseCustomDateTime_malformed_inputs_return_null", () => {
  assert.equal(parseCustomDateTime("not-a-date", "09:00"), null);
  assert.equal(parseCustomDateTime("2099-01-01", "99:99"), null);
});

test("todayDateString_returns_today_in_YYYY_MM_DD_local", () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  assert.equal(todayDateString(), expected);
});
