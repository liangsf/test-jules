<template>
  <div class="rich-text-editor-wrapper">
    <div class="toolbar">
      <button
        @click="triggerCheckSelectedText"
        :disabled="!isTextSelected"
        class="toolbar-btn"
      >
        Check Selection
      </button>
      <button
        @click="applyUserHighlight('yellow')"
        :disabled="!isTextSelected"
        class="toolbar-btn"
      >
        Highlight Yellow
      </button>
      <button
        @click="applyUserHighlight('green')"
        :disabled="!isTextSelected"
        class="toolbar-btn"
      >
        Highlight Green
      </button>
      <button
        @click="clearUserHighlights"
        :disabled="!isTextSelected"
        class="toolbar-btn"
      >
        Clear User Highlight
      </button>
    </div>
    <div
      ref="editorRef"
      contenteditable="true"
      @input="onInput"
      @blur="onInput"
      @click="handleEditorClick"
      v-html="localValue"
    ></div>
    <!-- Comment removed from here -->

    <!-- LanguageTool Suggestion Tooltip -->
    <div
      v-if="selectedMatch && ltTooltipStyle.display === 'block'"
      class="suggestion-tooltip"
      :style="ltTooltipStyle"
    >
      <p>
        <strong>{{ selectedMatch.message }}</strong>
      </p>
      <div
        v-if="
          selectedMatch.replacements && selectedMatch.replacements.length > 0
        "
      >
        <p>Replacements:</p>
        <ul>
          <li
            v-for="(r, i) in selectedMatch.replacements"
            :key="i"
            @click="acceptSuggestion(r.value)"
            class="suggestion-item"
          >
            {{ r.value }}
          </li>
        </ul>
      </div>
      <div v-else>
        <p><em>No specific replacements suggested.</em></p>
      </div>
      <button @click="closeLtTooltip">Close LT</button>
    </div>

    <!-- User Highlight Note Pop-up -->
    <div
      v-if="selectedHighlightIdForNote && notePopupStyle.display === 'block'"
      class="note-popup"
      :style="notePopupStyle"
    >
      <h4>Note for Highlight</h4>
      <textarea
        v-model="currentNoteText"
        placeholder="Enter your note..."
      ></textarea>
      <div class="note-popup-buttons">
        <button @click="saveNote">Save Note</button>
        <button @click="deleteNote" class="delete-note-btn">Delete Note</button>
        <button @click="closeNotePopup">Close</button>
      </div>
    </div>

    <div class="attribution">
      Powered by
      <a href="https://languagetool.org" target="_blank">LanguageTool</a>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
  defineProps,
  defineEmits,
  onMounted,
  reactive,
  nextTick,
  onUnmounted,
} from "vue";
import {
  checkText,
  LanguageToolResponse,
  LanguageToolMatch,
} from "../services/languageToolService";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits(["update:modelValue"]);

const editorRef = ref<HTMLDivElement | null>(null);
const localValue = ref(props.modelValue);
let debounceTimer: number | undefined;

const activeMatches = ref<LanguageToolMatch[]>([]);
const selectedMatch = ref<LanguageToolMatch | null>(null);
let currentlySelectedLtSpan: HTMLElement | null = null;
const ltTooltipStyle = reactive({ display: "none", top: "0px", left: "0px" });

const isTextSelected = ref(false);
const userNotes = ref<Record<string, string>>({});
const selectedHighlightIdForNote = ref<string | null>(null);
const currentNoteText = ref("");
let currentlySelectedUserSpan: HTMLElement | null = null;
const notePopupStyle = reactive({ display: "none", top: "0px", left: "0px" });

const generateUniqueId = () =>
  `user-highlight-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const handleSelectionChange = () => {
  if (!editorRef.value) return;
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    isTextSelected.value = !!(
      editorRef.value &&
      editorRef.value.contains(range.commonAncestorContainer) &&
      !range.collapsed
    );
  } else {
    isTextSelected.value = false;
  }
};

const applyUserHighlight = (color: string) => {
  if (!isTextSelected.value || !editorRef.value) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (
    !editorRef.value.contains(range.commonAncestorContainer) ||
    range.collapsed
  )
    return;

  const highlightId = generateUniqueId();
  const span = document.createElement("span");
  span.className = `user-highlight user-highlight-${color}`;
  span.setAttribute("data-highlight-id", highlightId);

  try {
    range.surroundContents(span);
  } catch (e) {
    console.warn("range.surroundContents() failed:", e);
    try {
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    } catch (e2) {
      console.error("Fallback highlight failed:", e2);
      return;
    }
  }

  localValue.value = editorRef.value.innerHTML;
  emit("update:modelValue", localValue.value);

  selectedHighlightIdForNote.value = highlightId;
  currentNoteText.value = userNotes.value[highlightId] || "";
  currentlySelectedUserSpan = span;
  calculateNotePopupPosition();

  selection.removeAllRanges();
  isTextSelected.value = false;
  debouncedCheckText();
};

const saveNote = () => {
  if (selectedHighlightIdForNote.value) {
    userNotes.value[selectedHighlightIdForNote.value] = currentNoteText.value;
  }
  closeNotePopup();
};

const deleteNote = () => {
  if (selectedHighlightIdForNote.value) {
    delete userNotes.value[selectedHighlightIdForNote.value];
  }
  closeNotePopup();
};

const closeNotePopup = () => {
  selectedHighlightIdForNote.value = null;
  currentNoteText.value = "";
  notePopupStyle.display = "none";
  if (currentlySelectedUserSpan) {
    currentlySelectedUserSpan = null;
  }
};

const calculateNotePopupPosition = () => {
  if (!currentlySelectedUserSpan || !editorRef.value) {
    notePopupStyle.display = "none";
    return;
  }
  const spanRect = currentlySelectedUserSpan.getBoundingClientRect();
  const editorRect = editorRef.value.getBoundingClientRect();
  let top = spanRect.bottom - editorRect.top + editorRef.value.scrollTop;
  let left = spanRect.left - editorRect.left + editorRef.value.scrollLeft;
  notePopupStyle.top = `${top + 5}px`;
  notePopupStyle.left = `${left}px`;
  notePopupStyle.display = "block";
  nextTick(() => {
    const popupElem = document.querySelector(".note-popup") as HTMLElement;
    if (popupElem && editorRef.value) {
      const popupRect = popupElem.getBoundingClientRect();
      const editorVisibleRect = editorRef.value.getBoundingClientRect();
      if (popupRect.right > editorVisibleRect.right) {
        const newLeft =
          editorVisibleRect.right -
          popupRect.width -
          (editorVisibleRect.left -
            editorRef.value.getBoundingClientRect().left);
        notePopupStyle.left = `${Math.max(0, newLeft)}px`;
      }
      if (popupRect.left < editorVisibleRect.left) {
        notePopupStyle.left = `${editorVisibleRect.left - editorRef.value.getBoundingClientRect().left}px`;
      }
    }
  });
};

interface TextSegment {
  node: Text;
  startOffsetGlobal: number;
  endOffsetGlobal: number;
  text: string;
}
const getTextSegments = (rootElement: HTMLElement): TextSegment[] => {
  const segments: TextSegment[] = [];
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null;
  let currentGlobalOffset = 0;
  while ((currentNode = walker.nextNode())) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const textNode = currentNode as Text;
      const textContent = textNode.textContent || "";
      if (textContent.length > 0) {
        segments.push({
          node: textNode,
          startOffsetGlobal: currentGlobalOffset,
          endOffsetGlobal: currentGlobalOffset + textContent.length,
          text: textContent,
        });
      }
      currentGlobalOffset += textContent.length;
    }
  }
  return segments;
};

const clearOldLanguageToolHighlights = () => {
  if (!editorRef.value) return;
  const oldHighlights = editorRef.value.querySelectorAll(
    "span.language-tool-highlight",
  );
  oldHighlights.forEach((span) => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
      parent.normalize();
    }
  });
};

const applyHighlights = (matchesToApply: LanguageToolMatch[]) => {
  if (!editorRef.value) return;
  const selectionState = preserveSelection();
  clearOldLanguageToolHighlights();
  activeMatches.value = matchesToApply;
  if (
    selectedMatch.value &&
    !matchesToApply.some(
      (m) =>
        m.offset === selectedMatch.value!.offset &&
        m.length === selectedMatch.value!.length &&
        m.message === selectedMatch.value!.message,
    )
  ) {
    closeLtTooltip();
  }
  if (matchesToApply.length === 0) {
    restoreSelection(selectionState);
    return;
  }
  const textSegments = getTextSegments(editorRef.value);
  for (let i = matchesToApply.length - 1; i >= 0; i--) {
    const match = matchesToApply[i];
    const matchStart = match.offset;
    const matchEnd = match.offset + match.length;
    const affectedSegments: Array<{
      segment: TextSegment;
      rangeStartInNode: number;
      rangeEndInNode: number;
    }> = [];
    for (const segment of textSegments) {
      if (
        matchEnd <= segment.startOffsetGlobal ||
        matchStart >= segment.endOffsetGlobal
      )
        continue;
      const rangeStartInNode = Math.max(
        0,
        matchStart - segment.startOffsetGlobal,
      );
      const rangeEndInNode = Math.min(
        segment.node.length,
        matchEnd - segment.startOffsetGlobal,
      );
      if (rangeStartInNode < rangeEndInNode) {
        affectedSegments.push({ segment, rangeStartInNode, rangeEndInNode });
      }
    }
    for (let j = affectedSegments.length - 1; j >= 0; j--) {
      const { segment, rangeStartInNode, rangeEndInNode } = affectedSegments[j];
      try {
        const range = document.createRange();
        range.setStart(segment.node, rangeStartInNode);
        range.setEnd(segment.node, rangeEndInNode);
        const highlightSpan = document.createElement("span");
        highlightSpan.className = "highlighted-issue language-tool-highlight";
        highlightSpan.setAttribute("data-match-index", i.toString());
        range.surroundContents(highlightSpan);
      } catch (e) {
        console.error(
          "Error surrounding content for LT highlight:",
          e,
          match,
          segment,
        );
      }
    }
  }
  editorRef.value.normalize();
  restoreSelection(selectionState);
};

const handleCheckText = async (
  isSelectionCheck: boolean = false,
  selectionDetails?: { text: string; startOffset: number; endOffset: number },
) => {
  if (!editorRef.value) return;
  let textToCheck = editorRef.value.innerText;
  let offsetToAdd = 0;
  if (isSelectionCheck && selectionDetails) {
    textToCheck = selectionDetails.text;
    offsetToAdd = selectionDetails.startOffset;
    if (textToCheck.trim() === "") return;
  } else if (textToCheck.trim() === "") {
    activeMatches.value = [];
    closeLtTooltip();
    clearOldLanguageToolHighlights();
    return;
  }
  try {
    const results: LanguageToolResponse = await checkText(textToCheck);
    const processedMatches = results.matches.map((match) => ({
      ...match,
      offset: match.offset + offsetToAdd,
    }));
    applyHighlights(processedMatches);
  } catch (error) {
    console.error("Error during LT check:", error);
    activeMatches.value = [];
    closeLtTooltip();
  }
};
const debouncedCheckText = () => {
  clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    handleCheckText(false);
  }, 1000);
};
const triggerCheckSelectedText = async () => {
  if (!editorRef.value || !isTextSelected.value) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (!editorRef.value.contains(range.commonAncestorContainer)) return;
  const selectedText = selection.toString();
  if (selectedText.trim() === "") return;
  const preSelectionRange = document.createRange();
  preSelectionRange.selectNodeContents(editorRef.value);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);
  const selectionStartOffset = preSelectionRange.toString().length;
  await handleCheckText(true, {
    text: selectedText,
    startOffset: selectionStartOffset,
    endOffset: selectionStartOffset + selectedText.length,
  });
};

const onInput = (event: Event) => {
  const target = event.target as HTMLDivElement;
  if (target) {
    const currentRawHTML = target.innerHTML;
    localValue.value = currentRawHTML;
    emit("update:modelValue", currentRawHTML);
    debouncedCheckText();
    handleSelectionChange();
  }
};

const handleEditorClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const ltHighlight = target.closest(".language-tool-highlight");
  if (ltHighlight && editorRef.value?.contains(ltHighlight)) {
    closeNotePopup();
    const matchIndexAttr = ltHighlight.getAttribute("data-match-index");
    if (matchIndexAttr) {
      const matchIndex = parseInt(matchIndexAttr, 10);
      if (activeMatches.value && activeMatches.value[matchIndex]) {
        selectedMatch.value = activeMatches.value[matchIndex];
        if (currentlySelectedLtSpan) {
          currentlySelectedLtSpan.classList.remove("selected-issue");
        }
        (ltHighlight as HTMLElement).classList.add("selected-issue");
        currentlySelectedLtSpan = ltHighlight as HTMLElement;
        calculateLtTooltipPosition();
      }
    }
    return;
  }

  const userHighlight = target.closest(".user-highlight");
  if (userHighlight && editorRef.value?.contains(userHighlight)) {
    closeLtTooltip();
    const highlightId = userHighlight.getAttribute("data-highlight-id");
    if (highlightId) {
      selectedHighlightIdForNote.value = highlightId;
      currentNoteText.value = userNotes.value[highlightId] || "";
      if (currentlySelectedUserSpan) {
        /* remove class if any */
      }
      currentlySelectedUserSpan = userHighlight as HTMLElement;
      /* add class if any */
      calculateNotePopupPosition();
    }
    return;
  }

  if (!(event.target as HTMLElement).closest(".suggestion-tooltip")) {
    closeLtTooltip();
  }
  if (!(event.target as HTMLElement).closest(".note-popup")) {
    closeNotePopup();
  }
};

const clearUserHighlights = () => {
  /* ... (same basic implementation as before) ... */
  if (!isTextSelected.value || !editorRef.value) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (
    !editorRef.value.contains(range.commonAncestorContainer) ||
    range.collapsed
  )
    return;
  let nodeToUnwrap: HTMLElement | null = null;
  let currentElement = range.commonAncestorContainer;
  while (currentElement && currentElement !== editorRef.value) {
    if (
      currentElement.nodeType === Node.ELEMENT_NODE &&
      (currentElement as HTMLElement).classList.contains("user-highlight")
    ) {
      nodeToUnwrap = currentElement as HTMLElement;
      break;
    }
    currentElement = currentElement.parentElement;
  }
  if (nodeToUnwrap) {
    const highlightId = nodeToUnwrap.getAttribute("data-highlight-id");
    const parent = nodeToUnwrap.parentNode;
    if (parent) {
      while (nodeToUnwrap.firstChild) {
        parent.insertBefore(nodeToUnwrap.firstChild, nodeToUnwrap);
      }
      parent.removeChild(nodeToUnwrap);
      parent.normalize();
      if (highlightId && userNotes.value[highlightId]) {
        delete userNotes.value[highlightId];
      } // Delete note
      if (selectedHighlightIdForNote.value === highlightId) {
        closeNotePopup();
      } // Close popup if it was for this
      localValue.value = editorRef.value.innerHTML;
      emit("update:modelValue", localValue.value);
      debouncedCheckText();
    }
  } else {
    console.warn(
      "Selection is not within a user highlight or clear operation is too complex.",
    );
  }
  selection.removeAllRanges();
  isTextSelected.value = false;
};

const calculateLtTooltipPosition = () => {
  if (!currentlySelectedLtSpan || !editorRef.value) {
    ltTooltipStyle.display = "none";
    return;
  }
  const spanRect = currentlySelectedLtSpan.getBoundingClientRect();
  const editorRect = editorRef.value.getBoundingClientRect();
  let top = spanRect.bottom - editorRect.top + editorRef.value.scrollTop;
  let left = spanRect.left - editorRect.left + editorRef.value.scrollLeft;
  ltTooltipStyle.top = `${top + 5}px`;
  ltTooltipStyle.left = `${left}px`;
  ltTooltipStyle.display = "block";
  nextTick(() => {
    const tooltipElem = document.querySelector(
      ".suggestion-tooltip",
    ) as HTMLElement;
    if (tooltipElem && editorRef.value) {
      const tooltipRect = tooltipElem.getBoundingClientRect();
      const editorVisibleRect = editorRef.value.getBoundingClientRect();
      if (tooltipRect.right > editorVisibleRect.right) {
        const newLeft =
          editorVisibleRect.right -
          tooltipRect.width -
          (editorVisibleRect.left -
            editorRef.value.getBoundingClientRect().left);
        ltTooltipStyle.left = `${Math.max(0, newLeft)}px`;
      }
      if (tooltipRect.left < editorVisibleRect.left) {
        ltTooltipStyle.left = `${editorVisibleRect.left - editorRef.value.getBoundingClientRect().left}px`;
      }
    }
  });
};
const closeLtTooltip = () => {
  selectedMatch.value = null;
  ltTooltipStyle.display = "none";
  if (currentlySelectedLtSpan) {
    currentlySelectedLtSpan.classList.remove("selected-issue");
    currentlySelectedLtSpan = null;
  }
};

const acceptSuggestion = (replacementValue: string) => {
  if (!editorRef.value || !selectedMatch.value) return;
  const matchToReplace = selectedMatch.value;
  const textSegments = getTextSegments(editorRef.value);
  const replacementRange = document.createRange();
  let foundStart = false;
  for (const segment of textSegments) {
    if (!foundStart && matchToReplace.offset < segment.endOffsetGlobal) {
      const start = Math.max(
        0,
        matchToReplace.offset - segment.startOffsetGlobal,
      );
      replacementRange.setStart(segment.node, start);
      foundStart = true;
    }
    if (
      foundStart &&
      matchToReplace.offset + matchToReplace.length <= segment.endOffsetGlobal
    ) {
      const end = Math.max(
        0,
        matchToReplace.offset +
          matchToReplace.length -
          segment.startOffsetGlobal,
      );
      replacementRange.setEnd(segment.node, end);
      break;
    }
  }
  if (!foundStart) {
    console.error("Could not map suggestion offset to DOM.");
    closeLtTooltip();
    return;
  }
  try {
    replacementRange.deleteContents();
    const newNode = document.createTextNode(replacementValue);
    replacementRange.insertNode(newNode);
    replacementRange.setStart(newNode, newNode.length);
    replacementRange.setEnd(newNode, newNode.length);
    replacementRange.collapse(true);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(replacementRange);
    }
    editorRef.value.focus();
  } catch (e) {
    console.error("Error applying suggestion to DOM:", e);
  }
  editorRef.value.normalize();
  localValue.value = editorRef.value.innerHTML;
  emit("update:modelValue", localValue.value);
  closeLtTooltip();
  debouncedCheckText();
};

const preserveSelection = (): {
  range: Range | null;
  selection: Selection | null;
} => {
  let selection: Selection | null = null;
  let range: Range | null = null;
  if (window.getSelection) {
    selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0);
      if (
        editorRef.value &&
        editorRef.value.contains(currentRange.commonAncestorContainer)
      ) {
        range = currentRange.cloneRange();
      }
    }
  }
  return { range, selection };
};
const restoreSelection = (state: {
  range: Range | null;
  selection: Selection | null;
}) => {
  if (state.range && state.selection && editorRef.value) {
    if (editorRef.value.contains(state.range.commonAncestorContainer)) {
      try {
        state.selection.removeAllRanges();
        state.selection.addRange(state.range);
        return;
      } catch (e) {
        console.warn("Could not restore selection range:", e);
      }
    }
  }
  if (editorRef.value && window.getSelection()) {
    const selection = window.getSelection()!;
    const newRange = document.createRange();
    newRange.selectNodeContents(editorRef.value);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
};

watch(
  () => props.modelValue,
  (newValue) => {
    if (editorRef.value && newValue !== editorRef.value.innerHTML) {
      localValue.value = newValue;
      editorRef.value.innerHTML = newValue;
      debouncedCheckText();
    }
  },
);

onMounted(() => {
  document.addEventListener("selectionchange", handleSelectionChange);
  if (editorRef.value) {
    editorRef.value.innerHTML = localValue.value;
    if (editorRef.value.innerText.trim() !== "") {
      debouncedCheckText();
    }
  }
});
onUnmounted(() => {
  document.removeEventListener("selectionchange", handleSelectionChange);
  clearTimeout(debounceTimer);
});
</script>

<style scoped>
/* ... (all previous styles including toolbar, btn, highlights, tooltips, attribution) ... */
.rich-text-editor-wrapper {
  position: relative;
}
.toolbar {
  padding: 5px;
  border-bottom: 1px solid #ccc;
  background-color: #f8f8f8;
  margin-bottom: 5px;
}
.toolbar-btn {
  margin-right: 5px;
  padding: 5px 10px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}
.toolbar-btn:disabled {
  background-color: #e0e0e0;
  color: #aaa;
  cursor: not-allowed;
}
.toolbar-btn:hover:not(:disabled) {
  background-color: #e0e0e0;
}
div[contenteditable] {
  border: 1px solid #ccc;
  padding: 10px;
  min-height: 150px;
  white-space: pre-wrap;
  word-wrap: break-word;
}
:deep(.highlighted-issue),
:deep(.language-tool-highlight) {
  text-decoration: underline;
  text-decoration-color: red;
  text-decoration-thickness: 2px;
  background-color: rgba(255, 0, 0, 0.1);
  cursor: pointer;
}
:deep(.selected-issue) {
  background-color: rgba(255, 0, 0, 0.25);
  border: 1px solid red;
}
:deep(.user-highlight) {
  /* Common style for all user highlights */
}
:deep(.user-highlight-yellow) {
  background-color: yellow;
}
:deep(.user-highlight-green) {
  background-color: lightgreen;
}

.suggestion-tooltip,
.note-popup {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  padding: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 300px;
  border-radius: 4px;
}
.suggestion-tooltip p,
.note-popup p {
  margin: 0 0 5px 0;
}
.suggestion-tooltip ul,
.note-popup ul {
  list-style-type: none;
  padding: 0;
  margin: 5px 0;
  max-height: 100px;
  overflow-y: auto;
}
.suggestion-tooltip .suggestion-item, .note-popup .suggestion-item /* if any */ {
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
  margin-bottom: 2px;
}
.suggestion-tooltip .suggestion-item:hover,
.note-popup .suggestion-item:hover {
  background-color: #f0f0f0;
}
.suggestion-tooltip button,
.note-popup button {
  margin-top: 5px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  background-color: #f8f8f8;
  border-radius: 3px;
  cursor: pointer;
  margin-right: 5px;
}
.suggestion-tooltip button:hover,
.note-popup button:hover {
  background-color: #e9e9e9;
}

.note-popup textarea {
  width: calc(100% - 16px);
  min-height: 60px;
  margin-bottom: 10px;
  border: 1px solid #ddd;
  padding: 5px;
  border-radius: 3px;
}
.note-popup-buttons button.delete-note-btn {
  background-color: #ffdddd;
}
.note-popup-buttons button.delete-note-btn:hover {
  background-color: #ffcccc;
}

.attribution {
  font-size: 0.8em;
  text-align: right;
  margin-top: 5px;
  color: #777;
}
.attribution a {
  color: #777;
  text-decoration: none;
}
.attribution a:hover {
  text-decoration: underline;
}
</style>
