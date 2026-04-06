# Timeline Visualizer - AI Agent Guide

## Project Overview

**Timeline Visualizer** is an interactive web-based timeline visualization tool for displaying chronological events across multiple timelines. It uses a hybrid rendering approach combining HTML5 Canvas for timeline tracks and DOM elements for interactive event cards.

The project is primarily documented in **Chinese** (both code comments and README).

### Key Features
- Multi-timeline support with color coding and categorization
- Interactive canvas-based timeline rendering with DOM event overlays
- Zoom (mouse wheel), pan (drag), and range selection for navigating time periods
- Event detail panel with full information display
- Import/Export JSON data functionality
- Category filtering system
- Right-click context menu for timeline editing/deletion
- Collapsible sidebar with smooth animation
- CSV to JSON conversion tools for data preparation

### Current Timelines
- **三体** (Three-Body): Science fiction literature timeline covering events from the novel series
- **物理学发展史** (Physics History): Scientific history timeline of physics development

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Structure | HTML5 |
| Styling | CSS3 (CSS Variables, Flexbox, Grid) |
| Logic | Vanilla JavaScript (ES6+, Class-based) |
| Rendering | HTML5 Canvas API + DOM Overlay |
| Data Format | JSON |
| Build System | None (static files only) |

### Browser Requirements
- Modern browsers with ES6+ support
- Canvas API support
- Fetch API support

---

## Project Structure

```
Timeline/
├── index.html              # Main entry point - contains all UI markup
├── Timeline.js             # Core application logic (~1121 lines)
├── index.js                # Entry point: defines TIMELINE_INDEX and initializes app
├── style.css               # Stylesheet with dark theme (~971 lines)
├── Readme.md               # Data format documentation and TODO list (in Chinese)
├── AGENTS.md               # This file - AI agent guide
├── LICENSE                 # Apache License 2.0
├── .gitignore              # Ignores Office temp files, *.tmp
├── CSV/                    # Data conversion utilities
│   ├── 0_CSVToJson.bat     # Windows batch launcher
│   ├── 0_CSVToJson.ps1     # PowerShell conversion script
│   ├── ThreeBody.csv       # Example CSV data source
│   ├── Physics.csv         # Physics timeline CSV source
│   └── Timelines.xlsx      # Excel template for timeline editing
└── TL_Data/                # Timeline JSON data files
    ├── TL_ThreeBody.json   # Three-Body timeline events
    └── TL_Physics.json     # Physics history timeline events
```

---

## Architecture Details

### Core Classes

#### `MyEvent` (in `Timeline.js`)
Event object structure:
```javascript
{
    year: Number,           // Event year (negative for BC)
    month: Number,          // Optional: 1-12 (negative for offset only)
    day: Number,            // Optional: 1-31 (negative for offset only)
    title: String,          // Event title (displayed in detail panel)
    label: String,          // Short label (displayed on timeline card)
    importance: Number,     // 0-7, affects label visibility priority
    desc: String,           // Brief description
    detail: String,         // Full detailed content
    era: String             // Historical period classification
}
```

#### `Timeline` (in `Timeline.js`)
Timeline object structure:
```javascript
{
    id: String,             // Unique identifier
    title: String,          // Display title
    color: String,          // Hex color code
    category: String,       // Category for filtering
    events: MyEvent[]       // Array of events
}
```

#### `TimelineApp` (main class in `Timeline.js`)
The singleton application class managing all timeline functionality:

```javascript
// Key properties
this.timelines          // Array of Timeline objects
this.activeTimelines    // Set of currently visible timeline IDs
this.viewStart/viewEnd  // Current time range being displayed
this.minYear/maxYear    // Overall time bounds
this.selectedEvent      // Currently selected event
this._eventElements     // Map for DOM element pooling (performance)
this.dragging           // Drag state for panning
this.hasDragged         // Distinguish drag from click
```

### Rendering Architecture

The application uses a **hybrid rendering approach**:

1. **Canvas Layer** (`#timelineCanvas`):
   - Draws timeline tracks (horizontal lines)
   - Draws time scale/grid lines
   - Draws event markers (dots on tracks)
   - Handles mouse events for panning

2. **DOM Overlay Layer** (`#eventsOverlay`):
   - Contains interactive event cards (`event-card` elements)
   - Displays event labels (vertical text)
   - Shows popup details on hover/click
   - Handles click interactions

3. **Detail Panel** (`#detailPanel`):
   - Fixed right-side panel for selected event details
   - Slides in/out with CSS transitions

### Data Flow

```
TIMELINE_INDEX (index.js) → fetch() → TimelineApp.timelines → render() → Canvas + DOM
                                      ↓
                              User interactions
                              (zoom, pan, select)
```

---

## Data Formats

### Timeline Index (`TIMELINE_INDEX` in `index.js`)
```javascript
const TIMELINE_INDEX = [
    {
        id: 'three-body',
        title: '三体',
        color: '#3b82f6',
        eventPath: './TL_Data/TL_ThreeBody.json',
        category: '科幻文学'
    },
    {
        id: 'quantum-physics',
        title: '物理学发展史',
        color: '#8b5cf6',
        eventPath: './TL_Data/TL_Physics.json',
        category: '科学史'
    }
];
```

### Event JSON Format (`TL_Data/*.json`)
```json
[
  {
    "year": 1979,
    "month": 10,
    "day": 21,
    "title": "叶文洁收到三体回复",
    "label": "叶收到三体回复",
    "importance": 7,
    "desc": "叶文洁收到三体世界的警告信息，并回复",
    "detail": "凌晨0点，在向太阳发射信息不到9年后...",
    "era": "黄金时代"
  }
]
```

### CSV Format (for data import)
CSV files should have these columns: `Year`, `Month`, `Day`, `Title`, `Lable`, `Importance`, `Desc`, `Detail`, `Era`

**Note**: Month and day can be negative for time offset (position adjustment) without display.

---

## Development Guide

### Running the Project

No build process is required. Simply open `index.html` in a modern web browser:

```bash
# Option 1: Direct file open
# Open index.html in browser

# Option 2: Simple HTTP server (recommended for fetch API)
cd Timeline
python -m http.server 8000
# Then visit http://localhost:8000
```

### Adding a New Timeline

1. **Create JSON data file** in `TL_Data/`:
   ```json
   [
     {"year": 1900, "month": 1, "day": 1, "title": "Event", "importance": 0, "desc": "...", "detail": "...", "era": "..."}
   ]
   ```

2. **Register in `TIMELINE_INDEX`** (in `index.js`):
   ```javascript
   const TIMELINE_INDEX = [
     // ... existing timelines
     {
       id: 'my-timeline',
       title: 'My Timeline',
       color: '#f59e0b',
       eventPath: './TL_Data/TL_MyTimeline.json',
       category: 'Custom Category'
     }
   ];
   ```

3. **Refresh browser** - the new timeline will appear in the sidebar

### Converting CSV to JSON

Use the provided PowerShell script:

```powershell
# Option 1: Drag CSV file onto 0_CSVToJson.bat
# Option 2: Run directly
.\CSV\0_CSVToJson.ps1 -InputFile ".\CSV\MyData.csv"
```

The script will:
- Convert CSV to formatted JSON
- Auto-copy to clipboard
- Optionally save to file

---

## Code Conventions

### Naming (as used in codebase)
- **Classes**: `PascalCase` (e.g., `TimelineApp`)
- **Methods/Variables**: `camelCase` (e.g., `renderSidebar`, `activeTimelines`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MIN_LABEL_SPACING`)
- **CSS Classes**: `kebab-case` (e.g., `event-card`, `timeline-item`)

### CSS Variables (Theme)
Located in `:root` in `style.css`:
```css
--bg-primary: #0f172a;      /* Main background */
--bg-secondary: #1e293b;    /* Card/panel background */
--bg-tertiary: #334155;     /* Input/button background */
--text-primary: #f8fafc;    /* Primary text */
--text-secondary: #94a3b8;  /* Secondary text */
--accent-blue: #3b82f6;     /* Primary accent */
--accent-purple: #8b5cf6;   /* Secondary accent */
--accent-emerald: #10b981;
--accent-rose: #f43f5e;
--accent-amber: #f59e0b;
--sidebar-animation-duration: 300ms;
```

### Event Handling Patterns
```javascript
// Drag detection pattern
this.dragging = true;
this.hasDragged = false;
this.dragStartX = e.clientX;

// In mousemove
if (Math.abs(e.clientX - this.dragStartX) > DRAG_THRESHOLD) {
    this.hasDragged = true;
}

// In click handler - ignore if was a drag
if (this.hasDragged) return;
```

---

## Key Implementation Details

### Virtual DOM for Event Cards
The application uses a Map-based object pooling system (`this._eventElements`) to:
- Reuse DOM elements instead of recreating
- Diff visible vs. hidden events
- Minimize DOM operations during render

### Time Scale Calculation
```javascript
calculateTimeStep(span) {
    if (span > 10000) return 1000;
    if (span > 5000) return 500;
    if (span > 1000) return 100;
    // ... etc
}
```

### Coordinate Mapping
```javascript
// Year to X coordinate
const x = ((year - this.viewStart) / timeSpan) * canvasWidth;

// X coordinate to Year
const year = this.viewStart + (x / canvasWidth) * timeSpan;
```

### Decimal Year Calculation
Events can have month/day for precise positioning. The `getDecimalYear()` method converts to decimal:
- January = 0.0, December ≈ 0.92
- Day further refines position

### Date Offset Feature
Negative month/day values are used for time offset without display:
- `{"year": 2007, "month": -6}` displays as "2007" but positions at 2007.5
- Useful when multiple events in same year need visual separation

---

## Known Issues and TODO (from Readme.md)

### Bugs
- Range slider minimum range is larger than wheel zoom minimum (5 years)
- After zooming to max with wheel, range slider cannot adjust in small ranges

### Features
- Mobile device compatibility (landscape mode)
- Convert detail panel to floating panel
- Drag-to-reorder in sidebar timeline list
- Bounce-back animation when dragging beyond limits
- Add toggle for showing current year marker

### Optimizations
- Separate important CSS variables for easier theming
- Optimize `renderSidebar` to avoid full regeneration

---

## Testing

No automated test suite exists. Manual testing checklist:

1. **Timeline Loading**: Verify all timelines load without console errors
2. **Navigation**: Test zoom (mouse wheel), pan (drag), reset view
3. **Range Slider**: Drag handles to adjust visible range
4. **Selection**: Click events to open detail panel
5. **Category Filter**: Click category tags to filter timelines
6. **Sidebar**: Test collapse/expand toggle
7. **CRUD Operations**: Create, edit, delete timelines via UI
8. **Context Menu**: Right-click timeline items for edit/delete
9. **Import/Export**: Test JSON import/export functionality
10. **Keyboard**: Test Escape (close panel), Arrow keys (navigate events)

---

## License

Apache License 2.0 - See `LICENSE` file

---

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `index.html` | HTML structure, UI layout | ~221 |
| `Timeline.js` | Application logic, rendering, interactions | ~1121 |
| `index.js` | Timeline index definition and app initialization | ~22 |
| `style.css` | Styling, theming, animations | ~971 |
| `TL_Data/*.json` | Timeline event data | varies |
| `CSV/0_CSVToJson.ps1` | CSV to JSON conversion utility | ~97 |
