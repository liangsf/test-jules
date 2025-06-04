import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from './RichTextEditor.vue';
import { nextTick } from 'vue';
import { LanguageToolMatch, LanguageToolResponse, checkText as actualCheckText } from '../services/languageToolService';

vi.mock('../services/languageToolService.ts');

const mockSelection = (
  selectedText: string,
  rangeCount: number = 1,
  container?: Node,
  startOffset = 0,
  endOffset = selectedText.length
) => {
  const actualContainer = container || document.body;
  if (!actualContainer.firstChild && selectedText) {
    actualContainer.appendChild(document.createTextNode(''));
  } else if (actualContainer.firstChild && actualContainer.firstChild.nodeType === Node.TEXT_NODE && selectedText && container !== actualContainer.firstChild) {
    // No-op
  }

  const rangeMock = {
    collapsed: selectedText.length === 0,
    commonAncestorContainer: actualContainer,
    startContainer: actualContainer,
    endContainer: actualContainer,
    startOffset,
    endOffset,
    setStart: vi.fn(),
    setEnd: vi.fn(),
    cloneRange: vi.fn().mockReturnThis(),
    surroundContents: vi.fn((spanToInsert: HTMLElement) => {
      if (actualContainer.nodeType === Node.TEXT_NODE) {
        const textNode = actualContainer as Text;
        const originalText = textNode.textContent || '';
        const textToSurround = originalText.substring(startOffset, endOffset);
        spanToInsert.textContent = textToSurround;
        const beforeText = originalText.substring(0, startOffset);
        const afterText = originalText.substring(endOffset);
        const parent = textNode.parentNode;
        if (parent) {
          if (beforeText) parent.insertBefore(document.createTextNode(beforeText), textNode);
          parent.insertBefore(spanToInsert, textNode);
          if (afterText) parent.insertBefore(document.createTextNode(afterText), textNode);
          parent.removeChild(textNode);
          parent.normalize();
        }
      } else if (actualContainer.nodeType === Node.ELEMENT_NODE) {
        const textNode = actualContainer.firstChild as Text;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const originalText = textNode.textContent || '';
            const textToSurround = originalText.substring(startOffset, endOffset);
            spanToInsert.textContent = textToSurround;
            const beforeText = originalText.substring(0, startOffset);
            const afterText = originalText.substring(endOffset);
            actualContainer.textContent = '';
            if(beforeText) actualContainer.appendChild(document.createTextNode(beforeText));
            actualContainer.appendChild(spanToInsert);
            if(afterText) actualContainer.appendChild(document.createTextNode(afterText));
        } else { (actualContainer as HTMLElement).appendChild(spanToInsert); }
      } else { (actualContainer as HTMLElement).appendChild(spanToInsert); }
    }),
    extractContents: vi.fn(() => { const frag = document.createDocumentFragment(); frag.appendChild(document.createTextNode(selectedText)); return frag; }),
    insertNode: vi.fn((node: Node) => { const parent = rangeMock.startContainer.nodeType === Node.TEXT_NODE ? rangeMock.startContainer.parentNode : rangeMock.startContainer; const beforeNode = rangeMock.startContainer.nodeType === Node.TEXT_NODE ? (rangeMock.startContainer as Text).splitText(rangeMock.startOffset) : null; if (parent) { parent.insertBefore(node, beforeNode); } }),
    deleteContents: vi.fn(() => { if (rangeMock.startContainer.nodeType === Node.TEXT_NODE && rangeMock.startContainer === rangeMock.endContainer) { const textNode = rangeMock.startContainer as Text; textNode.textContent = textNode.textContent!.substring(0, rangeMock.startOffset) + textNode.textContent!.substring(rangeMock.endOffset); } else { console.warn('[mockSelection] deleteContents mock simplified.'); } }),
    toString: () => selectedText,
  };
  (window.getSelection as ReturnType<typeof vi.fn>).mockReturnValue({
    rangeCount, removeAllRanges: vi.fn(), addRange: vi.fn(), getRangeAt: vi.fn(() => rangeMock), toString: vi.fn(() => selectedText),
  });
  return rangeMock;
};

describe('RichTextEditor.vue', () => {
  let mockedCheckText: ReturnType<typeof vi.fn<typeof actualCheckText>>;
  beforeEach(async () => {
    vi.stubGlobal('getSelection', vi.fn());
    vi.useFakeTimers();
    const service = await import('../services/languageToolService');
    mockedCheckText = service.checkText as ReturnType<typeof vi.fn<typeof actualCheckText>>;
    mockedCheckText.mockClear();
    mockedCheckText.mockResolvedValue({
        matches: [],
        software: { name: 'mock', version: '1', buildDate: '', apiVersion: 1, premium: false, premiumHint: '', status: '' },
        warnings: { incompleteResults: false },
        language: { name: 'English', code: 'en-US', detectedLanguage: { name: 'English', code: 'en-US', confidence: 1 } },
    } as LanguageToolResponse);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('renders initial content and updates v-model on input', async () => {
    const initialContent = '<p>Hello World</p>';
    const wrapper = mount(RichTextEditor, { props: { modelValue: initialContent } });
    const editorDiv = wrapper.find('[contenteditable=\"true\"]');
    expect(editorDiv.html()).toContain(initialContent);
    const newContent = '<p>Hello Vitest!</p>';
    editorDiv.element.innerHTML = newContent;
    await editorDiv.trigger('input');
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([newContent]);
    expect(editorDiv.html()).toContain(newContent);
    wrapper.unmount();
  });

  it('applies a user highlight when text is selected and highlight button is clicked', async () => {
    const initialText = 'This is some test text.';
    const wrapper = mount(RichTextEditor, { props: { modelValue: initialText }, attachTo: document.body });
    const editorDiv = wrapper.find('[contenteditable=\"true\"]').element as HTMLDivElement;
    editorDiv.innerHTML = initialText;
    (wrapper.vm as any).editorRef = editorDiv;
    const selectedText = 'test text';
    const startIndex = initialText.indexOf(selectedText);
    const textNode = editorDiv.firstChild!;
    expect(textNode.nodeType).toBe(Node.TEXT_NODE);
    mockSelection(selectedText, 1, textNode, startIndex, startIndex + selectedText.length);
    await (wrapper.vm as any).handleSelectionChange();
    await nextTick();
    expect((wrapper.vm as any).isTextSelected).toBe(true);
    await (wrapper.vm as any).applyUserHighlight('yellow');
    await nextTick();
    const editorHTML = editorDiv.innerHTML;
    // Changed to string concatenation for RegExp to avoid esbuild backtick issue
    expect(editorHTML).toMatch(new RegExp("<span class=\\\"user-highlight user-highlight-yellow\\\"[^>]*>" + selectedText + "</span>"));
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    const emittedValue = wrapper.emitted('update:modelValue')![0][0] as string;
    expect(emittedValue).toContain('user-highlight user-highlight-yellow');
    expect(emittedValue).toContain(selectedText);
    wrapper.unmount();
  });

  it('accepts a LanguageTool suggestion and updates content, then re-checks', async () => {
    const initialText = 'This is a mistak.';
    const mistakeText = 'mistak';
    const replacementText = 'mistake';
    const mistakeOffset = initialText.indexOf(mistakeText);
    const wrapper = mount(RichTextEditor, { props: { modelValue: initialText }, attachTo: document.body });
    const editorDiv = wrapper.find('[contenteditable=\"true\"]').element as HTMLDivElement;
    editorDiv.innerHTML = initialText;
    (wrapper.vm as any).editorRef = editorDiv;
    const mockMatch: LanguageToolMatch = {
      message: 'Spelling mistake', shortMessage: 'Spelling', offset: mistakeOffset, length: mistakeText.length,
      replacements: [{ value: replacementText }],
      context: { text: initialText, offset: mistakeOffset, length: mistakeText.length },
      rule: { id: 'SPELL_ERROR', description: 'Spelling error', issueType: 'spelling', category: { id: 'TYPO', name: 'Typo' } },
    };
    (wrapper.vm as any).activeMatches = [mockMatch];
    (wrapper.vm as any).selectedMatch = mockMatch;
    await nextTick();
    await (wrapper.vm as any).acceptSuggestion(replacementText);
    await nextTick();
    const expectedText = initialText.replace(mistakeText, replacementText);
    expect(editorDiv.innerText).toBe(expectedText);
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    const emittedHTML = wrapper.emitted('update:modelValue')![0][0] as string;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = emittedHTML;
    expect(tempDiv.innerText || emittedHTML).toBe(expectedText);
    await vi.advanceTimersByTimeAsync(1100);
    expect(mockedCheckText).toHaveBeenCalled();
    wrapper.unmount();
  });
});
