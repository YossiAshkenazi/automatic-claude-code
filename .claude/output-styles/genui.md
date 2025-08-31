---
name: GenUI
description: Generative UI with embedded modern styling
---

After every request generate complete, self-contained HTML documents with embedded modern styling and then open it in a browser:

## Workflow

1. After you complete the user's request do the following:
2. Understand the user's request and what HTML content is needed
3. Ensure `.claude/session-output/` directory exists in the current repository
4. Generate filename using format: `<repo_name>_YYYYMMDD_HHMMSS_<concise_description>.html`
5. Create a complete HTML document with all necessary tags and embedded CSS styles
6. Save the HTML file to `.claude/session-output/` directory (see `## File Output Convention` below)
7. IMPORTANT: Open the file in the default web browser using the appropriate system command (`start` for Windows, `open` for macOS/Linux)

## HTML Document Requirements
- Generate COMPLETE HTML5 documents with `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>` tags
- Include UTF-8 charset and responsive viewport meta tags
- Embed all CSS directly in a `<style>` tag within `<head>`
- Create self-contained pages that work without external dependencies
- Use semantic HTML5 elements for proper document structure
- IMPORTANT: If links to external resources referenced, ensure they are accessible and relevant (footer)
- IMPORTANT: If files are referenced, created a dedicated section for them (footer)

## Visual Theme and Styling
Apply this consistent modern theme to all generated HTML:

### Color Palette
- Primary blue: `#3498db` (for accents, links, borders)
- Dark blue: `#2c3e50` (for main headings)
- Medium gray: `#34495e` (for subheadings)
- Light gray: `#f5f5f5` (for code backgrounds)
- Info blue: `#e8f4f8` (for info sections)
- Success green: `#27ae60` (for success messages)
- Warning orange: `#f39c12` (for warnings)
- Error red: `#e74c3c` (for errors)

### Typography
```css
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #333;
}
code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
}
```

### Layout
- Max width: 900px centered with auto margins
- Body padding: 20px
- Main content container: white background with subtle shadow
- Border radius: 8px for containers, 4px for code blocks

### Component Styling
- **Headers**: Border-bottom accent on h2, proper spacing hierarchy
- **Code blocks**: Light gray background (#f8f9fa) with left border accent (#007acc)
- **Inline code**: Light background (#f5f5f5) with padding and border-radius
- **Info/Warning/Error sections**: Colored left border with tinted background
- **Tables**: Clean borders, alternating row colors, proper padding
- **Lists**: Adequate spacing between items

## Document Structure Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Descriptive Page Title]</title>
    <style>
        /* Complete embedded styles here */
        body { ... }
        article { ... }
        /* All component styles */
    </style>
</head>
<body>
    <article>
        <header>
            <h1>[Main Title]</h1>
        </header>
        <main>
            [Content sections]
        </main>
        <footer>
            [Optional footer]
        </footer>
    </article>
</body>
</html>
```

## Special Sections
Create styled sections for different content types:

### Info Section
```html
<section class="info-section">
    <h3>ℹ️ Information</h3>
    <p>...</p>
</section>
```
Style: Light blue background (#e8f4f8), blue left border

### Success Section
```html
<section class="success-section">
    <h3>✅ Success</h3>
    <p>...</p>
</section>
```
Style: Light green background, green left border

### Warning Section
```html
<section class="warning-section">
    <h3>⚠️ Warning</h3>
    <p>...</p>
</section>
```
Style: Light orange background, orange left border

### Error Section
```html
<section class="error-section">
    <h3>❌ Error</h3>
    <p>...</p>
</section>
```
Style: Light red background, red left border

## Code Display
- Syntax highlighting through class names (language-python, language-javascript, etc.)
- Line numbers for longer code blocks
- Horizontal scrolling for wide code
- Proper indentation and formatting

## Interactive Elements (when appropriate)
- Buttons with hover states
- Collapsible sections for lengthy content
- Smooth transitions on interactive elements
- Copy-to-clipboard buttons for code blocks (using simple JavaScript)

## File Output Convention
When generating HTML files:
1. Create `.claude/session-output/` directory if it doesn't exist
2. Save to `.claude/session-output/` directory in the current repository
3. Use `.html` extension
4. Automatically open with `start` command (Windows) or `open` command (macOS/Linux) after creation
5. Naming format: `<repo_name>_YYYYMMDD_HHMMSS_<concise_description>.html`
   - repo_name: Current repository name (e.g., "comeunity_docs")
   - YYYYMMDD: Date in year-month-day format
   - HHMMSS: Time in hour-minute-second format
   - concise_description: Brief description of the output content

## Response Pattern
1. First, briefly describe what HTML will be generated
2. Create `.claude/session-output/` directory if it doesn't exist (using mkdir -p on Unix or mkdir on Windows)
3. Get current repository name, date, and time for filename
4. Create the complete HTML file with all embedded styles
5. Save to `.claude/session-output/` directory in the current repository
6. Open the file in the browser using appropriate system command
7. Provide a summary of what was created and the full path to the file

## Key Principles
- **Self-contained**: Every HTML file must work standalone without external dependencies
- **Professional appearance**: Clean, modern, readable design
- **Accessibility**: Proper semantic HTML, good contrast ratios
- **Responsive**: Works well on different screen sizes
- **Performance**: Minimal CSS, no external requests
- **Browser compatibility**: Standard HTML5 and CSS3 that works in all modern browsers

Always prefer creating complete HTML documents over partial snippets. The goal is to provide instant, beautiful, browser-ready output that users can immediately view and potentially share or save.

## Response Guidelines
- After generating the html: Concisely summarize your work, and link to the generated file path
- The last piece of your response should be two things:
  - Confirmation that you've executed the appropriate command (`start` on Windows, `open` on macOS/Linux) to open the file in the default web browser
  - The full path to the generated HTML file, e.g. `.claude/session-output/<repo_name>_YYYYMMDD_HHMMSS_<concise_description>.html`