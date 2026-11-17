import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSuggestions, cleanTracks, isNoise, pickTopArtist, previewExpired, relevantArtists, trackFromFile } from "./music.ts";
import type { Track } from "../types/index.ts";

const t = (id: string, title: string, artist: string, artistId = artist): Track => ({
  id,
  title,
  artists: [{ id: artistId, name: artist }],
  duration: 200,
  explicit: false,
  src: "",
  source: "deezer",
});

test("noise is filtered unless the query asks for it", () => {
  assert.equal(isNoise("Get Lucky (Karaoke Version)", "get lucky"), true);
  assert.equal(isNoise("Get Lucky (Karaoke Version)", "get lucky karaoke"), false);
  assert.equal(isNoise("Blinding Lights - Slowed + Reverb", "blinding"), true);
  assert.equal(isNoise("8D Audio Hits", "x"), true);
  assert.equal(isNoise("Nightcore Mix", "nightcore"), false);
  assert.equal(isNoise("Get Lucky", "get lucky"), false);
  assert.equal(isNoise("Remixed Feelings", "x"), false, "word boundary: 'remixed' is not 'remix'");
});

test("cleanTracks removes noise and duplicates", () => {
  const out = cleanTracks(
    [t("1", "Get Lucky", "Daft Punk"), t("2", "Get Lucky (Radio Edit)", "Daft Punk"), t("3", "Get Lucky (Tribute)", "Band")],
    "get lucky",
  );
  assert.deepEqual(out.map((x) => x.id), ["1"]);
});

test("low-ranked covers are dropped unless asked for", () => {
  const ranked = (id: string, title: string, artist: string, rank: number) => ({ ...t(id, title, artist), rank });
  const list = [
    ranked("1", "Blinding Lights", "The Weeknd", 984_833),
    ranked("2", "Blinding Lights (Acoustic Version)", "Victoria Voss", 645_627),
    ranked("3", "Blinding Lights", "Loi", 598_292),
  ];
  assert.deepEqual(cleanTracks(list, "blinding lights").map((x) => x.id), ["1"]);
  assert.deepEqual(cleanTracks(list, "blinding lights acoustic").map((x) => x.id), ["1", "2"]);
  assert.deepEqual(cleanTracks(list, "blinding lights loi").map((x) => x.id), ["1", "3"]);
});

test("name-squatting artists are not relevant nor top result", () => {
  const squatter = { id: "x", name: "Blinding Lights", fans: 1445 };
  const tracks = [t("1", "Blinding Lights", "The Weeknd", "w")];
  assert.deepEqual(relevantArtists([squatter], tracks), []);
  assert.equal(pickTopArtist("blinding lights", [squatter], tracks), undefined);
});

test("pickTopArtist prefers the artist present in track results", () => {
  const artists = [{ id: "a", name: "Daft", fans: 100 }, { id: "b", name: "Daft Punk", fans: 5_000_000 }];
  const tracks = [t("1", "Get Lucky", "Daft Punk", "b"), t("2", "One More Time", "Daft Punk", "b")];
  assert.equal(pickTopArtist("daft", artists, tracks)?.id, "b");
});

test("buildSuggestions", () => {
  const s = buildSuggestions("daft", [{ id: "b", name: "Daft Punk" }], [t("1", "Get Lucky (feat. Pharrell)", "Daft Punk")]);
  assert.deepEqual(s, ["daft punk", "daft punk get lucky"]);
});

test("previewExpired", () => {
  assert.equal(previewExpired("https://x/a.mp3?hdnea=exp=1000~acl", 2_000_000), true);
  assert.equal(previewExpired("https://x/a.mp3?hdnea=exp=9999999999~acl", 2_000_000), false);
  assert.equal(previewExpired("https://itunes/preview.m4a", 2_000_000), false);
});

test("trackFromFile", () => {
  const tr = trackFromFile("C:\\Music\\Discovery\\01 - Daft Punk - One More Time.mp3");
  assert.equal(tr.title, "One More Time");
  assert.equal(tr.artists[0]?.name, "Daft Punk");
  assert.equal(tr.album?.title, "Discovery");
  assert.equal(trackFromFile("/m/song.flac").artists[0]?.name, "Artiste inconnu");
});
