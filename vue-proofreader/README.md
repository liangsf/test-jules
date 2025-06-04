# Vue3 Proofreader

This project is a Vue 3 application that provides a rich text editor with proofreading capabilities, inspired by Grammarly. It integrates with the LanguageTool API for grammar and spelling checks.

## Features

*   **Rich Text Editing:** Allows basic text input and manipulation.
*   **Grammar and Spell Checking:** Uses the [LanguageTool API](https://languagetool.org/http-api) to check text for errors and suggestions.
    *   Highlights issues directly in the editor.
    *   Displays suggestions in a tooltip on click.
    *   Allows accepting suggestions, which updates the text.
*   **User-Applied Highlights:** Users can apply colored highlights (e.g., yellow, green) to selected text for their own emphasis.
*   **Notes for Highlights:** Users can add, view, edit, and delete textual notes associated with their custom highlights (notes are session-only).
*   **Check Selected Text:** Users can select a portion of text and run a grammar/spell check specifically on that selection.
*   **DOM-Aware Updates:** LanguageTool highlights and suggestion applications are designed to preserve user-applied highlights and notes.
*   **Unit Tests:** Key functionalities of the rich text editor are covered by unit tests using Vitest.

## Getting Started

1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
3.  **Run the development server:**
    ```bash
    yarn dev
    ```
    The application will typically be available at `http://localhost:5173`.

## Known Issues

*   **Build Error:** There is a persistent `vue-tsc` type error that occurs during the build process (`yarn build`). This does not affect running the application in development mode (`yarn dev`) or the execution of unit tests (`yarn test`).
*   **Note Cleanup:** Textual notes associated with user-applied highlights are not automatically deleted if the highlighted text is removed through general editing (e.g., selecting and deleting a paragraph containing a highlighted section). Notes are correctly deleted if the "Clear User Highlight" button or the "Delete Note" button in the note pop-up is used.
*   **LanguageTool API Limits:** The public LanguageTool API used in this project has usage limits. For extensive or commercial use, consider hosting your own LanguageTool instance or using a premium API account. Attribution to LanguageTool is included in the UI as per their terms.
