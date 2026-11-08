const fs = require("fs");

const appJs = fs.readFileSync("web/src/App.vue", "utf8");

// Extract returned properties from web/src/App.vue
const returnMatch = appJs.match(/return\s*\{([\s\S]*?)\};\s*\}\s*\};\s*<\/script>/);
if (!returnMatch) {
  console.error("Could not find setup return block in App.vue");
  process.exit(1);
}

const returnedKeys = new Set(
  returnMatch[1]
    .split(",")
    .map(k => k.trim())
    .filter(Boolean)
    .map(k => k.split(/[\s:]/)[0])
);

console.log(`Found ${returnedKeys.size} exported properties in App.vue`);

const expected = [
  "taskStats", "quickAddText", "quickAddPriority", "quickAddSubmitting", "executeQuickAdd",
  "selectedTaskIds", "toggleSelectTask", "selectAllFilteredTasks", "clearSelectedTasks", "executeTaskBulkAction",
  "toggleTaskPinAction", "expandedSubtasks", "toggleSubtasksExpanded", "taskSubtaskInputs", "addSubtaskAction", "toggleSubtaskAction", "deleteSubtaskAction",
  "expandedNotes", "toggleNotesExpanded", "taskNoteInputs", "addNoteAction", "deleteNoteAction",
  "expandedAttachments", "toggleAttachmentsExpanded", "handleTaskAttachmentUpload", "deleteTaskAttachmentAction",
  "formatEstimate", "formatRelativeDue", "allTags", "progressPercentage",
  "openTaskForm", "saveTask", "deleteTask", "toggleTaskComplete", "updateTaskStatus",
  "addTagToForm", "removeTagFromForm", "addSubtaskToForm", "removeSubtaskFromForm"
];

let missing = 0;
for (const exp of expected) {
  if (!returnedKeys.has(exp)) {
    console.error("❌ MISSING KEY in setup return:", exp);
    missing++;
  }
}

if (missing === 0) {
  console.log("✅ All TaskFlow setup return properties verified successfully!");
} else {
  process.exit(1);
}
