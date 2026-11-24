import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, normalize } from "./format.ts";

test("formatTime", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(372.7), "6:12");
  assert.equal(formatTime(NaN), "-:--");
  assert.equal(formatTime(Infinity), "-:--");
});

test("normalize strips accents and case", () => {
  assert.equal(normalize("L'Été Indien"), "l'ete indien");
});

import { formatDuration, hueFromSeed, plural } from "./format.ts";

test("formatDuration", () => {
  assert.equal(formatDuration(42 * 60000), "42 min");
  assert.equal(formatDuration(65 * 60000), "1 h 05");
});

test("hueFromSeed is stable and bounded", () => {
  assert.equal(hueFromSeed("Daft Punk"), hueFromSeed("Daft Punk"));
  assert.ok(hueFromSeed("x") >= 0 && hueFromSeed("x") < 360);
});

test("plural", () => {
  assert.equal(plural(1, "titre", "titres"), "1 titre");
  assert.equal(plural(3, "titre", "titres"), "3 titres");
});
