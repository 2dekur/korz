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
