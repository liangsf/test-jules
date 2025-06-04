<template>
  <div id="app">
    <h1>Vue Proofreader</h1>
    <RichTextEditor v-model="editorContent" />
    <hr />
    <h2>Raw HTML Output:</h2>
    <pre>{{ editorContent }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import RichTextEditor from "./components/RichTextEditor.vue";

const editorContent = ref(
  "<p>Hello, <strong>world</strong>!</p><p>Start typing here...</p>",
);
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
  padding: 20px;
}

hr {
  margin: 20px 0;
}

pre {
  background-color: #f4f4f4;
  padding: 10px;
  border: 1px solid #ddd;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
