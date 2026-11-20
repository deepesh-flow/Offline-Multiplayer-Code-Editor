# Viva notes
Vite: the tool that runs your frontend in the browser while you develop and builds it for deployment.
React: the library that builds the page out of components. App.jsx is your main component.
@monaco-editor/react: wraps Monaco, the editor engine that powers VS Code, as a React component.
import Editor from ...: pulls the Monaco component into this file.
<Editor ... />: places the editor on the page. height="100%" fills its parent, defaultLanguage sets syntax highlighting, defaultValue is the starting text, theme sets dark mode.
height: "100vh" on the div: makes the parent as tall as the browser window, so the editor has room to fill.