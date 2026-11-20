import { test } from "node:test";
import assert from "node:assert/strict";
import { activeLineIndex, chunkLines, parseLrc, parsePlain } from "./lyrics.ts";

test("parseLrc handles metadata, multiple stamps, ordering and empty lines", () => {
  const lines = parseLrc("[ar:Werenoi]\n[00:16.43] J'connais pas\n[00:06.83][01:02.5] Refrain\n[00:09.34] \nno stamp");
  assert.deepEqual(lines, [
    { time: 6.83, text: "Refrain" },
    { time: 9.34, text: "" },
    { time: 16.43, text: "J'connais pas" },
    { time: 62.5, text: "Refrain" },
  ]);
});

test("activeLineIndex", () => {
  const lines = parseLrc("[00:01.00]a\n[00:05.00]b\n[00:10.00]c");
  assert.equal(activeLineIndex(lines, 0.5), -1);
  assert.equal(activeLineIndex(lines, 1), 0);
  assert.equal(activeLineIndex(lines, 7), 1);
  assert.equal(activeLineIndex(lines, 99), 2);
  assert.equal(activeLineIndex(parsePlain("x\ny"), 5), -1, "plain lyrics have no active line");
});

test("chunkLines respects the byte budget and keeps order", () => {
  const lines = ["é".repeat(100), "b".repeat(200), "c".repeat(200), "d"];
  const chunks = chunkLines(lines, 450);
  assert.deepEqual(chunks.flat(), lines);
  for (const c of chunks) assert.ok(new TextEncoder().encode(c.join("\n")).length <= 450);
  assert.equal(chunks.length, 2);
});
