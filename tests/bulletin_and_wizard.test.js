import test from "node:test";
import assert from "node:assert/strict";
import { generateWeeklyBulletin, getWeekDateRange } from "../src/services/bulletinService.js";
import { helpScreen, HELP_TOPICS } from "../src/bot/handlers/home.js";

test("Weekly Bulletin: getWeekDateRange generates valid 7-day range in YYYY-MM-DD format", () => {
  const range = getWeekDateRange(new Date("2026-10-05T12:00:00Z"));
  assert.ok(range.startStr.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(range.endStr.match(/^\d{4}-\d{2}-\d{2}$/));
  assert.ok(range.label.includes("முதல்"));
  assert.ok(range.label.includes("வரை"));
});

test("Weekly Bulletin: generateWeeklyBulletin produces Tamil O.V. BSI meditation verse & WhatsApp share link", async () => {
  const bulletin = await generateWeeklyBulletin();
  assert.ok(bulletin.rawWhatsAppText.includes("சேலம் பழமையான பாப்திஸ்து சபை"));
  assert.ok(bulletin.rawWhatsAppText.includes("வாராந்திர சபை சுற்றறிக்கை"));
  assert.ok(bulletin.rawWhatsAppText.includes("Tamil O.V. BSI"));
  assert.ok(bulletin.verse.ref.length > 0);
  assert.ok(bulletin.verse.text.length > 0);
  assert.ok(bulletin.whatsappUrl.startsWith("https://wa.me/?text="));
  assert.ok(bulletin.htmlText.includes("<b>சேலம் பழமையான பாப்திஸ்து சபை (SPBC)</b>"));
});

test("Help Wizard: helpScreen returns categorized topics and interactive navigation buttons", () => {
  // Test Overview topic
  const overview = helpScreen("overview");
  assert.ok(overview.text.includes("Administrator Guide"));
  assert.ok(overview.keyboard.length >= 4);

  // Check that all defined topics have valid non-empty content
  const topicKeys = ["members", "greetings", "bulletin", "events", "tasks", "scripture", "system"];
  for (const k of topicKeys) {
    const screen = helpScreen(k);
    assert.ok(screen.text.includes("<b>"), `Topic ${k} has formatted title`);
    assert.ok(HELP_TOPICS[k], `HELP_TOPICS has key ${k}`);
    
    // Check navigation buttons for sub-topics
    const hasBackToAll = screen.keyboard.some(row => row.some(btn => btn.text.includes("All Topics")));
    assert.ok(hasBackToAll, `Topic ${k} includes 'All Topics' navigation button`);
  }
});
